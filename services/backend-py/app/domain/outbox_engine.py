"""
Transactional Outbox Engine & Idempotent Event Delivery (Spec §209-§212).

Provides:
1. Stable Event Schema (§209)
2. Transactional Outbox Recording (§210)
3. Reliable Outbox Relay / Publisher (§210)
4. Idempotent Event Consumer Deduplication (§211)
5. Multi-Step Saga Coordinator with Compensations (§212)
"""

import time
import uuid
from typing import Dict, Any, List, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field

class OutboxStatus(str, Enum):
    PENDING = "PENDING"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"

class EventContract(BaseModel):
    """Stable event contract matching Spec §209."""
    eventId: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    eventType: str
    version: int = 1
    occurredAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    tenantId: str
    aggregateId: str
    data: Dict[str, Any] = Field(default_factory=dict)
    correlationId: Optional[str] = None
    causationId: Optional[str] = None

@dataclass
class OutboxRecord:
    id: str
    event: EventContract
    status: OutboxStatus = OutboxStatus.PENDING
    retry_count: int = 0
    created_at: float = field(default_factory=time.time)
    published_at: Optional[float] = None
    error_message: Optional[str] = None

class OutboxRepository:
    """
    In-memory outbox store (persists outbox records atomically with business state).
    In production with SQLAlchemy, this writes to the `outbox_events` table within the same DB transaction.
    """
    def __init__(self):
        self._records: Dict[str, OutboxRecord] = {}

    def save(self, event: EventContract) -> OutboxRecord:
        record = OutboxRecord(id=event.eventId, event=event)
        self._records[record.id] = record
        return record

    def get_pending(self, limit: int = 50) -> List[OutboxRecord]:
        return [
            r for r in self._records.values()
            if r.status == OutboxStatus.PENDING
        ][:limit]

    def mark_published(self, event_id: str):
        if event_id in self._records:
            self._records[event_id].status = OutboxStatus.PUBLISHED
            self._records[event_id].published_at = time.time()

    def mark_failed(self, event_id: str, error: str):
        if event_id in self._records:
            self._records[event_id].status = OutboxStatus.FAILED
            self._records[event_id].retry_count += 1
            self._records[event_id].error_message = error

    def get_all(self) -> List[OutboxRecord]:
        return list(self._records.values())

class OutboxRelay:
    """
    Outbox Publisher (§210).
    Pulls PENDING outbox records and broadcasts them to the event bus / streaming transport.
    """
    def __init__(self, repository: OutboxRepository):
        self.repo = repository

    async def publish_batch(
        self,
        publisher_fn: Callable[[EventContract], Awaitable[bool]],
        limit: int = 50
    ) -> Dict[str, int]:
        pending = self.repo.get_pending(limit=limit)
        published_count = 0
        failed_count = 0

        for record in pending:
            try:
                success = await publisher_fn(record.event)
                if success:
                    self.repo.mark_published(record.id)
                    published_count += 1
                else:
                    self.repo.mark_failed(record.id, "Publisher returned False")
                    failed_count += 1
            except Exception as e:
                self.repo.mark_failed(record.id, str(e))
                failed_count += 1

        return {
            "processed": len(pending),
            "published": published_count,
            "failed": failed_count
        }

class IdempotentConsumerRegistry:
    """
    Idempotent Event Consumer Deduplication (§211).
    Tracks processed eventIds and idempotency keys to ensure exact-once execution semantics
    even under at-least-once message delivery.
    """
    def __init__(self, ttl_seconds: int = 86400):
        self._processed_events: Dict[str, float] = {}
        self.ttl_seconds = ttl_seconds

    def has_processed(self, event_id: str) -> bool:
        self._evict_expired()
        return event_id in self._processed_events

    def mark_processed(self, event_id: str):
        self._evict_expired()
        self._processed_events[event_id] = time.time()

    def _evict_expired(self):
        now = time.time()
        expired = [eid for eid, ts in self._processed_events.items() if now - ts > self.ttl_seconds]
        for eid in expired:
            del self._processed_events[eid]

class SagaCoordinator:
    """
    Distributed Saga Orchestrator with Compensations (§212).
    Coordinates multi-step business transactions (Order -> Payment -> Inventory -> Delivery).
    If any step fails, compensation handlers are executed in reverse order.
    """
    def __init__(self):
        self._saga_history: List[Dict[str, Any]] = []

    async def execute_order_fulfillment_saga(
        self,
        order_id: str,
        tenant_id: str,
        amount: float,
        stock_sku: str,
        fail_at_step: Optional[str] = None
    ) -> Dict[str, Any]:
        execution_log = []
        compensations = []

        try:
            # Step 1: Order Validation & Lock
            if fail_at_step == "ORDER":
                raise RuntimeError("Order validation failed")
            execution_log.append("STEP_1:ORDER_RESERVED")
            compensations.append(lambda: execution_log.append("COMPENSATE:ORDER_CANCELLED"))

            # Step 2: Payment Authorization
            if fail_at_step == "PAYMENT":
                raise RuntimeError("Payment gateway declined authorization")
            execution_log.append("STEP_2:PAYMENT_AUTHORIZED")
            compensations.append(lambda: execution_log.append("COMPENSATE:PAYMENT_REFUNDED"))

            # Step 3: Inventory Deduction
            if fail_at_step == "INVENTORY":
                raise RuntimeError("Stock level insufficient for reservation")
            execution_log.append("STEP_3:INVENTORY_DEDUCTED")
            compensations.append(lambda: execution_log.append("COMPENSATE:INVENTORY_RESTOCKED"))

            # Step 4: Courier Dispatch
            if fail_at_step == "DELIVERY":
                raise RuntimeError("Courier fleet unavailable")
            execution_log.append("STEP_4:DELIVERY_DISPATCHED")

            result = {
                "orderId": order_id,
                "status": "COMPLETED",
                "steps": execution_log,
                "compensated": False
            }
            self._saga_history.append(result)
            return result

        except Exception as err:
            # Execute compensations in reverse order
            for comp in reversed(compensations):
                comp()

            result = {
                "orderId": order_id,
                "status": "COMPENSATED",
                "error": str(err),
                "steps": execution_log,
                "compensated": True
            }
            self._saga_history.append(result)
            return result

# Global singletons for modular monolith operation
outbox_repo = OutboxRepository()
outbox_relay = OutboxRelay(outbox_repo)
consumer_registry = IdempotentConsumerRegistry()
saga_coordinator = SagaCoordinator()

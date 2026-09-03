from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.dependencies import get_current_user, TenantUser
from app.domain.outbox_engine import (
    outbox_repo,
    outbox_relay,
    consumer_registry,
    saga_coordinator,
    EventContract,
    OutboxStatus
)
from app.domain.event_bus import event_bus


router = APIRouter(prefix="/outbox", tags=["Modular Monolith -> Microservice Evolution (Spec §198-§227)"])

class TriggerSagaInput(BaseModel):
    orderId: str = "ord_test_99"
    amount: float = 120.00
    stockSku: str = "MBP-14-M3"
    failAtStep: Optional[str] = None  # ORDER, PAYMENT, INVENTORY, DELIVERY

class ConsumeEventInput(BaseModel):
    event: EventContract

@router.get("/status")
async def get_outbox_status(user: TenantUser = Depends(get_current_user)):
    """
    Returns the current transactional outbox metrics and pending queues (Spec §210).
    """
    records = outbox_repo.get_all()
    pending = [r for r in records if r.status == OutboxStatus.PENDING]
    published = [r for r in records if r.status == OutboxStatus.PUBLISHED]
    failed = [r for r in records if r.status == OutboxStatus.FAILED]

    return {
        "total": len(records),
        "pendingCount": len(pending),
        "publishedCount": len(published),
        "failedCount": len(failed),
        "recentEvents": [
            {
                "id": r.id,
                "eventType": r.event.eventType,
                "status": r.status.value,
                "retryCount": r.retry_count,
                "occurredAt": r.event.occurredAt
            }
            for r in records[-10:]
        ]
    }

@router.post("/publish")
async def trigger_outbox_relay(user: TenantUser = Depends(get_current_user)):
    """
    Pulls PENDING outbox events and publishes them to the platform event bus (Spec §210).
    """
    async def _bus_publisher(evt: EventContract) -> bool:
        await event_bus.publish(
            org_id=evt.tenantId,
            event_type=evt.eventType,
            data=evt.data
        )
        return True


    summary = await outbox_relay.publish_batch(publisher_fn=_bus_publisher)
    return {
        "status": "COMPLETED",
        "summary": summary
    }

@router.post("/saga/test")
async def test_order_saga(
    inp: TriggerSagaInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Executes a multi-step Saga with automated compensations on failure (Spec §212).
    """
    result = await saga_coordinator.execute_order_fulfillment_saga(
        order_id=inp.orderId,
        tenant_id=user.organization_id,
        amount=inp.amount,
        stock_sku=inp.stockSku,
        fail_at_step=inp.failAtStep
    )
    return result

@router.post("/consume")
async def consume_event_idempotently(
    inp: ConsumeEventInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Consumes an event with strict idempotent deduplication (Spec §211).
    """
    if consumer_registry.has_processed(inp.event.eventId):
        return {
            "eventId": inp.event.eventId,
            "status": "DUPLICATE_IGNORED",
            "message": f"Event {inp.event.eventId} was already processed. Skipped without duplicate action."
        }

    # Process business action
    consumer_registry.mark_processed(inp.event.eventId)
    return {
        "eventId": inp.event.eventId,
        "status": "PROCESSED_SUCCESSFULLY",
        "eventType": inp.event.eventType
    }

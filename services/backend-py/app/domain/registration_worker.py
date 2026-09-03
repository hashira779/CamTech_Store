import asyncio
import json
import logging
import os
import time
import uuid
from typing import Dict, Any, Optional
import redis.asyncio as aioredis
from app.domain.outbox_engine import outbox_repo, EventContract

logger = logging.getLogger("registration_worker")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QUEUE_KEY = "mystore:events:user_registered"

# In-memory fallback queue for local development without active Redis daemon
_in_memory_queue = asyncio.Queue()

async def get_redis_client() -> Optional[aioredis.Redis]:
    try:
        client = aioredis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1.0)
        await client.ping()
        return client
    except Exception:
        return None

async def dispatch_user_registered_event(user_data: Dict[str, Any]) -> str:
    """
    Sub-15ms Event Dispatcher:
    1. Records to Transactional Outbox (Atomicity & Reliability)
    2. Pushes event to Redis Queue (or in-memory async worker queue)
    3. Returns immediately without waiting for background worker processing.
    """
    event_id = f"evt_reg_{uuid.uuid4().hex[:10]}"
    
    event = EventContract(
        eventId=event_id,
        eventType="USER_REGISTERED",
        tenantId=user_data.get("organizationId", "default_org"),
        aggregateId=user_data["id"],
        data={
            "userId": user_data["id"],
            "email": user_data["email"],
            "name": user_data.get("name", "Valued Customer"),
            "organizationId": user_data.get("organizationId", "default_org"),
            "registeredAt": time.time()
        }
    )
    
    # 1. Save to outbox
    outbox_repo.save(event)
    
    # 2. Push to Redis or In-Memory Queue
    redis_client = await get_redis_client()
    if redis_client:
        try:
            await redis_client.lpush(QUEUE_KEY, json.dumps(event.model_dump()))
            await redis_client.close()
        except Exception as ex:
            logger.warning(f"Redis push failed, falling back to in-memory queue: {ex}")
            await _in_memory_queue.put(event.model_dump())
    else:
        await _in_memory_queue.put(event.model_dump())

    # Trigger async background worker execution immediately in task pool
    asyncio.create_task(process_registration_background_worker(event.model_dump()))
    
    return event_id

async def process_registration_background_worker(event_payload: Dict[str, Any]):
    """
    Asynchronous Background Worker:
    1. Generates 100 Welcome Loyalty Points
    2. Generates Welcome Coupon Code: WELCOME10OFF
    3. Simulates Email Dispatch without blocking user registration latency
    """
    data = event_payload.get("data", {})
    user_id = data.get("userId")
    email = data.get("email")
    name = data.get("name")
    
    # Artificial micro-delay simulating external email SMTP and coupon generation
    await asyncio.sleep(0.05)
    
    # 1. Welcome Loyalty Points Record
    welcome_points = 100
    loyalty_tier = "SILVER_TIER"
    
    # 2. Welcome Promo Voucher
    welcome_coupon = f"WELCOME-10-{uuid.uuid4().hex[:6].upper()}"
    
    # 3. Notification dispatch
    email_notification = {
        "to": email,
        "subject": f"Welcome to CamTech, {name}!",
        "voucherCode": welcome_coupon,
        "pointsAwarded": welcome_points
    }
    
    # Mark outbox event published
    outbox_repo.mark_published(event_payload.get("eventId", ""))
    
    logger.info(
        f"✅ [Background Worker] Processed UserRegistered for {email}: "
        f"Coupon={welcome_coupon}, Points={welcome_points}, Tier={loyalty_tier}"
    )
    
    return {
        "status": "COMPLETED",
        "userId": user_id,
        "email": email,
        "couponCode": welcome_coupon,
        "loyaltyPoints": welcome_points,
        "notification": email_notification
    }

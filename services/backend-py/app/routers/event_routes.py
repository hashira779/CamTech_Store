import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from app.core.dependencies import get_current_user, TenantUser
from app.domain.event_bus import event_bus

router = APIRouter(prefix="/events", tags=["2026-2030 Real-Time Event Stream (SSE)"])

class BroadcastEventInput(BaseModel):
    eventType: str
    payload: Dict[str, Any]

@router.get("/stream")
async def event_stream(
    request: Request,
    user: TenantUser = Depends(get_current_user)
):
    """
    State-of-the-Art 2026–2030 Real-Time Server-Sent Events (SSE) Stream.
    Pushes live events (sales, deliveries, approvals, stock alerts) with automatic keep-alive.
    """
    org_id = user.organization_id
    pubsub = await event_bus.get_pubsub(org_id)

    async def sse_generator():
        # Initial connected frame
        init_frame = {
            "event": "STREAM_CONNECTED",
            "data": {
                "organizationId": org_id,
                "userId": user.id,
                "serverTime": datetime.now(timezone.utc).isoformat(),
                "status": "HEALTHY",
                "standard": "2026-2030 Enterprise Real-time Streaming"
            }
        }
        yield f"data: {json.dumps(init_frame)}\n\n"

        try:
            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break

                # wait for message up to 15s to keep connection alive
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                if message is not None:
                    if message["type"] == "message":
                        yield message["data"]
                else:
                    # Timeout reached, send keep-alive heartbeat ping
                    hb = {
                        "event": "HEARTBEAT",
                        "data": {"timestamp": datetime.now(timezone.utc).isoformat()}
                    }
                    yield f"data: {json.dumps(hb)}\n\n"
        finally:
            await pubsub.unsubscribe()
            await pubsub.close()

    origin = request.headers.get("origin") or "*"
    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "*",
        }
    )

@router.post("/broadcast")
async def broadcast_test_event(
    inp: BroadcastEventInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Broadcasts a test enterprise event across the tenant's real-time SSE stream.
    """
    await event_bus.publish(
        org_id=user.organization_id,
        event_type=inp.eventType,
        data=inp.payload
    )
    return {
        "success": True,
        "broadcasted": True,
        "event": inp.eventType,
        "organizationId": user.organization_id
    }

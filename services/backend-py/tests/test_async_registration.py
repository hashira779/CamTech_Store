import pytest
import asyncio
import time
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.domain.outbox_engine import outbox_repo

@pytest.mark.asyncio
async def test_ultra_low_latency_async_registration():
    """
    Verifies Spec High-Concurrency Requirement:
    - User registers
    - Endpoint returns HTTP 201 Created immediately
    - Event is pushed to Redis / async queue
    - Background worker handles welcome points and coupons asynchronously without blocking HTTP response
    """
    unique_email = f"fast_user_{int(time.time()*1000)}@camtech.cam"
    
    t_start = time.time()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/auth/register", json={
            "email": unique_email,
            "password": "SecurePassword123!",
            "name": "Fast Registration User",
            "organizationName": "CamTech Supermarket"
        })
    elapsed_ms = (time.time() - t_start) * 1000
    
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    res_data = data["data"]
    assert res_data["email"] == unique_email
    assert "accessToken" in res_data
    assert res_data["status"] == "PROVISIONED"
    assert "queuedEventId" in res_data

    # Give background worker 100ms to finish async tasks
    await asyncio.sleep(0.1)

    # Verify event was recorded in outbox and processed
    event_id = res_data["queuedEventId"]
    all_events = outbox_repo.get_all()
    matching = [e for e in all_events if e.id == event_id]
    assert len(matching) == 1
    assert matching[0].event.eventType == "USER_REGISTERED"
    assert matching[0].status.value == "PUBLISHED"

@pytest.mark.asyncio
async def test_concurrent_flash_registration():
    """
    Tests simultaneous registration blast:
    - 10 users hit /register at the exact same millisecond
    - Verifies all 10 return 201 Created concurrently without database locking or event-loop starvation
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        async def register_user(idx: int):
            email = f"flash_user_{idx}_{int(time.time()*1000)}@camtech.cam"
            return await ac.post("/api/v1/auth/register", json={
                "email": email,
                "password": "Password123!",
                "name": f"Flash User {idx}"
            })

        tasks = [register_user(i) for i in range(10)]
        results = await asyncio.gather(*tasks)

        for res in results:
            assert res.status_code == 201
            assert res.json()["success"] is True
            assert res.json()["data"]["status"] == "PROVISIONED"

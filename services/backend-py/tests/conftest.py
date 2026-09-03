import pytest
import pytest_asyncio
from app.core.database import engine

@pytest_asyncio.fixture(autouse=True)
async def cleanup_database_connections():
    yield
    # Safely release asyncpg connections before event loop teardown
    await engine.dispose()

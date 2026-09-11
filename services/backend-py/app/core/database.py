from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings
from typing import AsyncGenerator

# Clean asyncpg connection string
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

import os as _os
_search_path = _os.getenv("DB_SEARCH_PATH")
_connect_args = {
    "command_timeout": 30.0,
    "statement_cache_size": 1024,
}
if _search_path:
    _connect_args["server_settings"] = {"search_path": _search_path}

# Enterprise High-Concurrency Connection Pooling (Spec §198, §199)
DB_POOL_SIZE = int(_os.getenv("DB_POOL_SIZE", "50"))
DB_MAX_OVERFLOW = int(_os.getenv("DB_MAX_OVERFLOW", "30"))
DB_POOL_TIMEOUT = float(_os.getenv("DB_POOL_TIMEOUT", "45.0"))
DB_POOL_RECYCLE = int(_os.getenv("DB_POOL_RECYCLE", "1800"))

engine = create_async_engine(
    database_url,
    echo=False,
    future=True,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_recycle=DB_POOL_RECYCLE,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Read-Replica Connection Pool (Phase 4 Topology — Spec §198, §199)
replica_database_url = _os.getenv("REPLICA_DATABASE_URL", database_url)
if replica_database_url.startswith("postgresql://"):
    replica_database_url = replica_database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

read_engine = create_async_engine(
    replica_database_url,
    echo=False,
    future=True,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_recycle=DB_POOL_RECYCLE,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

AsyncReadSessionLocal = async_sessionmaker(
    bind=read_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Primary database session for transactional writes and state mutations."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """Read-replica database session for analytics, dashboards, and reporting queries."""
    async with AsyncReadSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


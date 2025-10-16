"""Database connection management with asyncpg."""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import asyncpg  # type: ignore
from dotenv import load_dotenv

load_dotenv()

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


async def init_db_pool() -> None:
    """Initialize asyncpg connection pool."""
    global _pool
    
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    db_port = os.getenv("DB_PORT")
    db_host = os.getenv("DB_HOST")
    
    # Construct the database URL
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    if not db_url:
        raise ValueError("Database url is not set")
    
    print(f"🔌 Initializing asyncpg connection pool to {db_host}:{db_port}/{db_name}")
    
    _pool = await asyncpg.create_pool(
        db_url,
        min_size=5,
        max_size=20,
        command_timeout=60,
    )
    
    print("✅ Database pool initialized")


async def close_db_pool() -> None:
    """Close asyncpg connection pool."""
    global _pool
    if _pool:
        print("🔌 Closing database pool...")
        await _pool.close()
        print("✅ Database pool closed")


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Dependency for FastAPI endpoints to get database connection."""
    if not _pool:
        raise RuntimeError("Database pool not initialized")
    
    async with _pool.acquire() as connection:
        yield connection


@asynccontextmanager
async def transaction(conn: asyncpg.Connection) -> AsyncGenerator[asyncpg.Connection, None]:
    """Simple transaction context manager.
    
    Usage:
        async with transaction(conn):
            await conn.execute(query1, *params1)
            await conn.execute(query2, *params2)
            # Commits on success, rolls back on exception
    """
    tr = conn.transaction()
    await tr.start()
    try:
        yield conn
        await tr.commit()
    except Exception:
        await tr.rollback()
        raise


def get_pool() -> Optional[asyncpg.Pool]:
    """Get the global connection pool (for WebSocket handlers)."""
    return _pool

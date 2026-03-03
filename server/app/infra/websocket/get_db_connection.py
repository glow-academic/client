"""Database connection helper for WebSocket handlers."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import asyncpg

from app.globals import get_pool


@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get database connection for WebSocket handlers.

    Same logic as get_db() but works as a proper async context manager.
    Raises RuntimeError if pool is not initialized.

    This provides consistency with HTTP routes that use `Depends(get_db)`.
    WebSocket handlers should catch RuntimeError and emit error events
    (Socket.IO already logs framework-level errors).

    Usage:
        try:
            async with get_db_connection() as conn:
                result = await execute_sql_typed(conn, SQL_PATH, params=params)
        except RuntimeError:
            # Pool not initialized - emit error event
            await rubric_generation_error(...)

    Raises:
        RuntimeError: If database connection pool is not initialized
    """
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database connection pool not initialized")

    async with pool.acquire() as connection:
        yield connection

"""Database connection management with asyncpg."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import TYPE_CHECKING

import asyncpg  # type: ignore
from dotenv import load_dotenv

load_dotenv()

# Global connection pool
_pool: asyncpg.Pool | None = None
if TYPE_CHECKING:  # pragma: no cover - runtime import happens lazily
    from testcontainers.postgres import \
        PostgresContainer  # type: ignore[import]

_test_container: PostgresContainer | None = None


async def init_db_pool() -> None:
    """Initialize asyncpg connection pool."""
    global _pool, _test_container

    env_name = os.getenv("ENV", "DEV").upper()

    if env_name == "TEST":
        print("🐳 TEST mode detected: starting disposable Postgres with Testcontainers")
        from testcontainers.postgres import \
            PostgresContainer  # type: ignore[import]

        _test_container = PostgresContainer("postgres:16")
        _test_container.start()

        raw_url = _test_container.get_connection_url()
        db_url = raw_url.replace("postgresql+psycopg2://", "postgresql://")

        pool_config = {
            "min_size": 1,
            "max_size": 5,
        }

        _pool = await asyncpg.create_pool(db_url, **pool_config)
        print(f"✅ Using test database at {db_url}")

        schema_path = Path(__file__).resolve().parent.parent / "tests" / "test-schema.sql"
        if not schema_path.exists():
            raise FileNotFoundError(
                f"Test schema file not found at {schema_path}. \n"
                "Generate it with 'make generate-test-schema'."
            )

        schema_sql = schema_path.read_text()
        async with _pool.acquire() as conn:
            await conn.execute(schema_sql)
        print("🗄️  Test schema applied to disposable database")
        return

    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    db_port = os.getenv("DB_PORT")
    db_host = os.getenv("DB_HOST")

    # Construct the database URL
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    if not all([db_user, db_password, db_name, db_port, db_host]):
        raise ValueError("Database configuration is incomplete")

    # Detect if we're connecting through PgBouncer
    # PgBouncer in transaction mode requires disabling prepared statements
    using_pgbouncer = db_host == "pgbouncer"

    print(f"🔌 Initializing asyncpg connection pool to {db_host}:{db_port}/{db_name}")

    pool_config = {
        "min_size": 10,
        "max_size": 100,  # High capacity for concurrent analytics + background refresh
        "command_timeout": 60,  # Allow time for complex analytics queries (cold cache)
        "max_queries": 50000,  # Limit queries per connection before recycling
        "max_inactive_connection_lifetime": 300,  # 5 minutes
    }

    # Note: When using PgBouncer in production:
    # - Set PgBouncer pool_mode=transaction (recommended for FastAPI)
    # - Configure PgBouncer: default_pool_size=25, max_client_conn=200
    # - This gives you: 100 app connections -> PgBouncer -> 25 DB connections
    # - Reduces DB connection overhead while maintaining app concurrency

    # Disable prepared statements for PgBouncer transaction mode
    if using_pgbouncer:
        pool_config["statement_cache_size"] = 0
        print(
            "   ⚙️  PgBouncer detected: Disabling prepared statements for transaction mode compatibility"
        )
    else:
        print(
            "   ⚙️  Direct connection: Using prepared statements for better performance"
        )

    _pool = await asyncpg.create_pool(db_url, **pool_config)

    print("✅ Database pool initialized")


async def close_db_pool() -> None:
    """Close asyncpg connection pool."""
    global _pool, _test_container
    if _pool:
        print("🔌 Closing database pool...")
        await _pool.close()
        _pool = None
        print("✅ Database pool closed")

    if _test_container:
        print("🐳 Stopping test database container...")
        _test_container.stop()
        _test_container = None
        print("✅ Test database container stopped")


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Dependency for FastAPI endpoints to get database connection."""
    if not _pool:
        raise RuntimeError("Database pool not initialized")

    async with _pool.acquire() as connection:
        yield connection


@asynccontextmanager
async def transaction(
    conn: asyncpg.Connection,
) -> AsyncGenerator[asyncpg.Connection, None]:
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


def get_pool() -> asyncpg.Pool | None:
    """Get the global connection pool (for WebSocket handlers)."""
    return _pool

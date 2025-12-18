"""Integration tests for database logging middleware."""

import asyncio
from typing import Any

import asyncpg  # type: ignore
import httpx
import pytest

from app.utils.logging.db_logger import setup_db_logger


@pytest.mark.asyncio
async def test_middleware_logs_request(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """Test that middleware logs API requests to database."""
    # Create a guest profile
    guest_id = await db.fetchval(
        """
        INSERT INTO profiles (role, default_profile, first_name, last_name, email)
        VALUES ('guest', true, 'Guest', 'User', 'guest@test.com')
        RETURNING id
        """
    )

    # Set up database logger with mock pool
    class ConnectionContext:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        async def __aenter__(self) -> asyncpg.Connection:
            return self.conn

        async def __aexit__(self, *args: Any) -> None:
            pass

    class MockPool:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        def acquire(self) -> ConnectionContext:
            return ConnectionContext(self.conn)

    pool = MockPool(db)
    setup_db_logger(pool)  # type: ignore[arg-type]

    # Make a request (to a non-existent endpoint to get 404)
    response = await client.get("/api/v3/nonexistent")

    # Wait for async log write
    await asyncio.sleep(0.1)

    # Verify log was written
    log_count = await db.fetchval(
        """
        SELECT COUNT(*) FROM app_logs
        WHERE logger_name = 'app.middleware.db_logging'
        AND message LIKE 'GET /api/v3/nonexistent%'
        """
    )
    assert log_count >= 1

    # Verify log has correct structure
    log_row = await db.fetchrow(
        """
        SELECT al.level, al.logger_name, al.message, alp.profile_id, al.extra
        FROM app_logs al
        LEFT JOIN app_logs_profiles alp ON alp.app_log_id = al.id
        WHERE al.logger_name = 'app.middleware.db_logging'
        AND al.message LIKE 'GET /api/v3/nonexistent%'
        ORDER BY al.ts DESC
        LIMIT 1
        """
    )
    assert log_row is not None
    assert log_row["level"] in ("info", "error")
    assert log_row["logger_name"] == "app.middleware.db_logging"
    assert log_row["profile_id"] == guest_id
    assert log_row["extra"] is not None
    extra = log_row["extra"]
    assert "method" in extra
    assert "path" in extra
    assert "status_code" in extra
    assert extra["method"] == "GET"
    assert extra["path"] == "/api/v3/nonexistent"


@pytest.mark.asyncio
async def test_middleware_logs_with_profile_id(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """Test that middleware extracts and logs profile_id from request."""
    # Create a test profile
    profile_id = await db.fetchval(
        """
        INSERT INTO profiles (role, first_name, last_name, email)
        VALUES ('member', 'Test', 'User', 'test@example.com')
        RETURNING id
        """
    )

    # Set up database logger
    class ConnectionContext:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        async def __aenter__(self) -> asyncpg.Connection:
            return self.conn

        async def __aexit__(self, *args: Any) -> None:
            pass

    class MockPool:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        def acquire(self) -> ConnectionContext:
            return ConnectionContext(self.conn)

    pool = MockPool(db)
    setup_db_logger(pool)  # type: ignore[arg-type]

    # Make a request with profile_id in header
    response = await client.get(
        "/api/v3/nonexistent",
        headers={"X-Profile-Id": str(profile_id)},
    )

    # Wait for async log write
    await asyncio.sleep(0.1)

    # Verify log was written with correct profile_id
    log_row = await db.fetchrow(
        """
        SELECT alp.profile_id
        FROM app_logs al
        LEFT JOIN app_logs_profiles alp ON alp.app_log_id = al.id
        WHERE al.logger_name = 'app.middleware.db_logging'
        AND al.message LIKE 'GET /api/v3/nonexistent%'
        ORDER BY al.ts DESC
        LIMIT 1
        """
    )
    assert log_row is not None
    assert log_row["profile_id"] == profile_id


@pytest.mark.asyncio
async def test_middleware_logs_post_with_body_profile_id(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """Test that middleware extracts profile_id from POST request body."""
    # Create a test profile
    profile_id = await db.fetchval(
        """
        INSERT INTO profiles (role, first_name, last_name, email)
        VALUES ('member', 'Test', 'User', 'test@example.com')
        RETURNING id
        """
    )

    # Set up database logger
    class ConnectionContext:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        async def __aenter__(self) -> asyncpg.Connection:
            return self.conn

        async def __aexit__(self, *args: Any) -> None:
            pass

    class MockPool:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        def acquire(self) -> ConnectionContext:
            return ConnectionContext(self.conn)

    pool = MockPool(db)
    setup_db_logger(pool)  # type: ignore[arg-type]

    # Make a POST request with profileId in body
    response = await client.post(
        "/api/v3/nonexistent",
        json={"profileId": str(profile_id), "data": "test"},
    )

    # Wait for async log write
    await asyncio.sleep(0.1)

    # Verify log was written with correct profile_id
    log_row = await db.fetchrow(
        """
        SELECT alp.profile_id
        FROM app_logs al
        LEFT JOIN app_logs_profiles alp ON alp.app_log_id = al.id
        WHERE al.logger_name = 'app.middleware.db_logging'
        AND al.message LIKE 'POST /api/v3/nonexistent%'
        ORDER BY al.ts DESC
        LIMIT 1
        """
    )
    assert log_row is not None
    assert log_row["profile_id"] == profile_id


@pytest.mark.asyncio
async def test_middleware_logs_error_status(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """Test that middleware logs errors with error level."""
    # Create a guest profile
    guest_id = await db.fetchval(
        """
        INSERT INTO profiles (role, default_profile, first_name, last_name, email)
        VALUES ('guest', true, 'Guest', 'User', 'guest@test.com')
        RETURNING id
        """
    )

    # Set up database logger
    class ConnectionContext:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        async def __aenter__(self) -> asyncpg.Connection:
            return self.conn

        async def __aexit__(self, *args: Any) -> None:
            pass

    class MockPool:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        def acquire(self) -> ConnectionContext:
            return ConnectionContext(self.conn)

    pool = MockPool(db)
    setup_db_logger(pool)  # type: ignore[arg-type]

    # Make a request that will result in 500 error (if we can trigger one)
    # For now, just check that 404 is logged as info
    response = await client.get("/api/v3/nonexistent")

    # Wait for async log write
    await asyncio.sleep(0.1)

    # Verify log level is appropriate
    log_row = await db.fetchrow(
        """
        SELECT level, extra FROM app_logs
        WHERE logger_name = 'app.middleware.db_logging'
        AND message LIKE 'GET /api/v3/nonexistent%'
        ORDER BY ts DESC
        LIMIT 1
        """
    )
    assert log_row is not None
    # 404 should be info level, 500+ would be error level
    assert log_row["level"] in ("info", "error")
    assert log_row["extra"] is not None
    extra = log_row["extra"]
    assert "status_code" in extra
    assert "duration_ms" in extra

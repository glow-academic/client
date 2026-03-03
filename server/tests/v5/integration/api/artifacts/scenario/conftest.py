"""Shared fixtures for scenario artifact integration tests.

SQL types, views, and functions are bootstrapped once per session by
tests/conftest.py via bootstrap_all_sql(). This file only contains:
- Seed data for the test profile department link
- A scenario created via the save endpoint (for list tests)
- Session-scoped db and client fixtures
"""

from collections.abc import AsyncGenerator

import asyncpg  # type: ignore
import httpx
import pytest_asyncio
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

from app.server import fastapi_app
from app.globals import get_db, get_pool

# Ensure the test superadmin profile is linked to the Purdue CS department so
# that artifact GET endpoints (which require ≥1 accessible department) work.
_SEED_PROFILE_DEPARTMENT_SQL = """
INSERT INTO profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp)
VALUES (
    '019b3be4-36f0-788c-9df2-481eb5917940',
    '019bb25e-e624-73da-8cef-166028a1065a',
    true, true, NOW(), false, false
) ON CONFLICT (profile_id, department_id) DO NOTHING;
"""

SEED_NAME_ID = "019b995c-8e80-7928-900e-d366eb410e53"


@pytest_asyncio.fixture(loop_scope="session", scope="session", autouse=True)
async def seed_scenario_data() -> None:
    """Seed test data needed by scenario artifact tests.

    SQL bootstrap is handled by tests/conftest.py. This only inserts
    the profile-department link required by GET endpoints, then creates
    a scenario via the save endpoint so list tests have data.
    """
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool not available. Did initialize_test_db run?")

    async with pool.acquire() as conn:
        await conn.execute(_SEED_PROFILE_DEPARTMENT_SQL)

    # Create a scenario via the save endpoint so list tests have a scenario.
    async def _override_get_db() -> AsyncGenerator[asyncpg.Connection, None]:
        async with pool.acquire() as c:
            yield c

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        headers = {"X-Bypass-Cache": "1", "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
        await c.post(
            "/api/v5/artifacts/scenarios/save",
            json={"input_scenario_id": None, "name_id": SEED_NAME_ID},
            headers=headers,
        )
    fastapi_app.dependency_overrides.clear()


@pytest_asyncio.fixture(loop_scope="session", scope="session")
async def db(seed_scenario_data: None) -> AsyncGenerator[asyncpg.Connection, None]:
    """Session-scoped database connection using the test pool.

    NOTE: Session-scoped means mutations are NOT rolled back between tests.
    Tests should be written to tolerate this.
    """
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool not available. Did initialize_test_db run?")

    conn = await pool.acquire()
    try:
        yield conn
    finally:
        await pool.release(conn)


@pytest_asyncio.fixture(loop_scope="session", scope="session")
async def client(
    db: asyncpg.Connection,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Session-scoped HTTP test client with database dependency override."""

    async def override_get_db() -> AsyncGenerator[asyncpg.Connection, None]:
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db

    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as test_client:
        yield test_client

    fastapi_app.dependency_overrides.clear()

"""Shared fixtures for simulations resource integration tests.

SQL types, views, and functions are bootstrapped once per session by
tests/conftest.py via bootstrap_all_sql(). This file only contains:
- Seed data for the test profile department link
- Session-scoped db and client fixtures
"""

from collections.abc import AsyncGenerator

import asyncpg  # type: ignore
import httpx
import pytest_asyncio

from app.v5.server import fastapi_app
from app.v5.infra.globals import get_db, get_pool

# Ensure the test superadmin profile is linked to the Purdue CS department so
# that resource endpoints (which require profile context) work.
_SEED_PROFILE_DEPARTMENT_SQL = """
INSERT INTO profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp)
VALUES (
    '019b3be4-36f0-788c-9df2-481eb5917940',
    '019bb25e-e624-73da-8cef-166028a1065a',
    true, true, NOW(), false, false
) ON CONFLICT (profile_id, department_id) DO NOTHING;
"""


@pytest_asyncio.fixture(loop_scope="session", scope="session", autouse=True)
async def seed_simulations_resource_data() -> None:
    """Seed test data needed by simulations resource tests."""
    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool not available. Did initialize_test_db run?")

    async with pool.acquire() as conn:
        await conn.execute(_SEED_PROFILE_DEPARTMENT_SQL)


@pytest_asyncio.fixture(loop_scope="session", scope="session")
async def db(
    seed_simulations_resource_data: None,
) -> AsyncGenerator[asyncpg.Connection, None]:
    """Session-scoped database connection using the test pool."""
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

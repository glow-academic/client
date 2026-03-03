"""Shared fixtures for cohort artifact integration tests.

SQL types, views, and functions are bootstrapped once per session by
tests/conftest.py via bootstrap_all_sql(). This file only contains:
- Seed data for the test profile department link
- Test cohort creation via direct SQL (correct table names)
- Session-scoped db and client fixtures
"""

from collections.abc import AsyncGenerator

import asyncpg  # type: ignore
import httpx
import pytest_asyncio

from app.v5.server import fastapi_app
from app.v5.infra.globals import get_db, get_pool

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

# Create a test cohort with name, description, active flag, and department link.
# Uses the correct *_artifact/*_resource/*_junction table names.
_SEED_COHORT_SQL = """
WITH new_artifact AS (
    INSERT INTO cohort_artifact (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id
),
name_resource AS (
    INSERT INTO names_resource (name)
    VALUES ('Test Cohort ' || gen_random_uuid()::text)
    RETURNING id
),
description_resource AS (
    INSERT INTO descriptions_resource (description)
    VALUES ('Test Description ' || gen_random_uuid()::text)
    RETURNING id
),
active_flag AS (
    SELECT id FROM flags_resource WHERE name = 'cohort_active' LIMIT 1
),
link_name AS (
    INSERT INTO cohort_names_junction (cohort_id, name_id)
    SELECT na.id, nr.id FROM new_artifact na, name_resource nr
    RETURNING cohort_id
),
link_description AS (
    INSERT INTO cohort_descriptions_junction (cohort_id, description_id)
    SELECT na.id, dr.id FROM new_artifact na, description_resource dr
    RETURNING cohort_id
),
link_flag AS (
    INSERT INTO cohort_flags_junction (cohort_id, flag_id, value)
    SELECT na.id, af.id, true FROM new_artifact na, active_flag af
    RETURNING cohort_id
),
link_department AS (
    INSERT INTO cohort_departments_junction (cohort_id, department_id)
    SELECT na.id, '019bb25e-e624-73da-8cef-166028a1065a'::uuid
    FROM new_artifact na
    RETURNING cohort_id
)
SELECT na.id as cohort_id FROM new_artifact na;
"""

# Module-level variable to store the seed cohort ID created during setup
_seed_cohort_id: str | None = None


@pytest_asyncio.fixture(loop_scope="session", scope="session", autouse=True)
async def seed_cohort_data() -> None:
    """Seed test data needed by cohort artifact tests.

    SQL bootstrap is handled by tests/conftest.py. This inserts:
    1. The profile-department link required by GET endpoints
    2. A test cohort with name, description, flag, and department link
    """
    global _seed_cohort_id

    pool = get_pool()
    if pool is None:
        raise RuntimeError("Database pool not available. Did initialize_test_db run?")

    async with pool.acquire() as conn:
        await conn.execute(_SEED_PROFILE_DEPARTMENT_SQL)

        # Create a test cohort using direct SQL with correct table names
        row = await conn.fetchrow(_SEED_COHORT_SQL)
        if row:
            _seed_cohort_id = str(row["cohort_id"])


@pytest_asyncio.fixture(loop_scope="session", scope="session")
async def seed_cohort_id(seed_cohort_data: None) -> str:
    """Return the seed cohort ID created during setup."""
    if _seed_cohort_id is None:
        raise RuntimeError("Seed cohort was not created. Did seed_cohort_data run?")
    return _seed_cohort_id


@pytest_asyncio.fixture(loop_scope="session", scope="session")
async def db(seed_cohort_data: None) -> AsyncGenerator[asyncpg.Connection, None]:
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

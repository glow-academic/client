"""Route tests for POST /api/v3/cohorts/detail-default endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


async def test_get_cohort_detail_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default cohort detail for a user."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a cohort linked to the user's department
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Default Cohort', 'Default Description', true) RETURNING id"
    )

    # Link cohort to department
    await db.execute(
        "INSERT INTO cohort_departments(cohort_id, department_id, active) "
        "VALUES ($1, $2, true)",
        cohort_id,
        dept_id,
    )

    # Link profile to department
    await db.execute(
        "INSERT INTO profile_departments(profile_id, department_id, active) "
        "VALUES ($1, $2, true) ON CONFLICT DO NOTHING",
        profile_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/cohorts/detail-default",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "title" in data
    assert "description" in data
    assert "active" in data
    assert "simulations" in data
    assert "staff" in data
    assert isinstance(data["simulations"], list)
    assert isinstance(data["staff"], list)


async def test_get_cohort_detail_default_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test default cohort detail when no cohort exists for user's departments."""
    # Create a profile not linked to any department
    profile_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, role, active) "
        "VALUES ('Test', 'User', 'guest', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO profile_emails(profile_id, email, is_primary, active) "
        "VALUES($1, 'redacted@purdue.edu', true, true)",
        profile_id
    )

    response = await client.post(
        "/api/v3/cohorts/detail-default",
        json={"profileId": str(profile_id)},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "no cohort found" in data["detail"].lower()

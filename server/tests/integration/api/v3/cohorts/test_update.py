"""Route tests for POST /api/v3/cohorts/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    )

pytestmark = pytest.mark.asyncio


async def test_update_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a cohort."""
    # Create a cohort first
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Original Title', 'Original Description', true) RETURNING id"
    )

    dept_id = await get_cs_dept_id(db)

    response = await client.post(
        "/api/v3/cohorts/update",
        json={
            "cohortId": str(cohort_id),
            "title": "Updated Title",
            "description": "Updated Description",
            "active": False,
            "department_ids": [str(dept_id)],
            "profile_ids": [],
            "simulation_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Cohort updated successfully"

    # Verify cohort was updated
    cohort = await db.fetchrow("SELECT * FROM cohorts WHERE id = $1", cohort_id)
    assert cohort is not None
    assert cohort["title"] == "Updated Title"
    assert cohort["description"] == "Updated Description"
    assert cohort["active"] is False

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM cohort_departments WHERE cohort_id = $1 AND department_id = $2",
        cohort_id,
        dept_id,
    )
    assert dept_link is not None


async def test_update_cohort_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent cohort."""
    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    await client.post(
        "/api/v3/cohorts/update",
        json={
            "cohortId": fake_cohort_id,
            "title": "Updated Title",
            "description": "Updated Description",
            "active": True,
            "department_ids": [],
            "profile_ids": [],
            "simulation_ids": [],
        },
    )

    # Update should succeed even if cohort doesn't exist (no error raised)
    # But let's verify the cohort wasn't created
    cohort = await db.fetchrow("SELECT * FROM cohorts WHERE id = $1", fake_cohort_id)
    assert cohort is None

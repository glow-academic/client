"""Route tests for POST /api/v3/cohorts/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (get_cs_dept_id,  # type: ignore
                                get_superadmin_alias)

pytestmark = pytest.mark.asyncio


async def test_create_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new cohort with all fields."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Get a simulation ID
    simulation_id = await db.fetchval("SELECT id FROM simulations LIMIT 1")
    if not simulation_id:
        # Create a simulation if none exists
        rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
        if not rubric_id:
            rubric_id = await db.fetchval(
                "INSERT INTO rubrics(name, description, points, pass_points, active) "
                "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
            )
        simulation_id = await db.fetchval(
            "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
            "VALUES ('Test Simulation', 'Test', true, false, $1) RETURNING id",
            rubric_id,
        )

    # Get a profile ID (not the superadmin)
    other_profile_id = await db.fetchval(
        "SELECT id FROM profiles WHERE alias != 'sarava18' LIMIT 1"
    )
    if not other_profile_id:
        other_profile_id = await db.fetchval(
            "INSERT INTO profiles(first_name, last_name, alias, role, active) "
            "VALUES ('Test', 'User', 'testuser', 'guest', true) RETURNING id"
        )

    response = await client.post(
        "/api/v3/cohorts/create",
        json={
            "title": "Test Cohort",
            "description": "Test Description",
            "active": True,
            "department_ids": [str(dept_id)],
            "profile_ids": [str(other_profile_id)],
            "simulation_ids": [str(simulation_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "cohortId" in data
    assert data["message"] == "Cohort created successfully"

    # Verify cohort was created in database
    cohort = await db.fetchrow(
        "SELECT * FROM cohorts WHERE id = $1", data["cohortId"]
    )
    assert cohort is not None
    assert cohort["title"] == "Test Cohort"
    assert cohort["description"] == "Test Description"
    assert cohort["active"] is True

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM cohort_departments WHERE cohort_id = $1 AND department_id = $2",
        data["cohortId"],
        dept_id,
    )
    assert dept_link is not None

    # Verify profile link was created
    profile_link = await db.fetchrow(
        "SELECT * FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2",
        data["cohortId"],
        other_profile_id,
    )
    assert profile_link is not None

    # Verify simulation link was created
    sim_link = await db.fetchrow(
        "SELECT * FROM cohort_simulations WHERE cohort_id = $1 AND simulation_id = $2",
        data["cohortId"],
        simulation_id,
    )
    assert sim_link is not None


async def test_create_cohort_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a cohort with minimal fields."""
    response = await client.post(
        "/api/v3/cohorts/create",
        json={
            "title": "Minimal Cohort",
            "description": "",  # Empty string instead of None (description is NOT NULL)
            "active": True,
            "department_ids": [],
            "profile_ids": [],
            "simulation_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "cohortId" in data

    # Verify cohort was created
    cohort = await db.fetchrow(
        "SELECT * FROM cohorts WHERE id = $1", data["cohortId"]
    )
    assert cohort is not None
    assert cohort["title"] == "Minimal Cohort"
    assert cohort["description"] == ""  # Empty string, not None


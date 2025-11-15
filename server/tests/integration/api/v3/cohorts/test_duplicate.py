"""Route tests for POST /api/v3/cohorts/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_duplicate_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a cohort."""
    # Create a cohort with relationships
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Original Cohort', 'Original Description', true) RETURNING id"
    )

    dept_id = await get_cs_dept_id(db)
    await db.execute(
        "INSERT INTO cohort_departments(cohort_id, department_id, active) "
        "VALUES ($1, $2, true)",
        cohort_id,
        dept_id,
    )

    # Add a profile
    profile_id = await db.fetchval("SELECT id FROM profiles LIMIT 1")
    if profile_id:
        await db.execute(
            "INSERT INTO cohort_profiles(cohort_id, profile_id) VALUES ($1, $2)",
            cohort_id,
            profile_id,
        )

    # Add a simulation
    simulation_id = await db.fetchval("SELECT id FROM simulations LIMIT 1")
    if not simulation_id:
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
    if simulation_id:
        await db.execute(
            "INSERT INTO cohort_simulations(cohort_id, simulation_id) VALUES ($1, $2)",
            cohort_id,
            simulation_id,
        )

    response = await client.post(
        "/api/v3/cohorts/duplicate",
        json={"cohortId": str(cohort_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "cohortId" in data
    assert data["cohortId"] != str(cohort_id)  # New cohort ID
    assert "Original Cohort" in data["message"]

    # Verify duplicate was created
    duplicate = await db.fetchrow(
        "SELECT * FROM cohorts WHERE id = $1", data["cohortId"]
    )
    assert duplicate is not None
    # Duplicate adds " Copy" to the title
    assert duplicate["title"] == "Original Cohort Copy"
    assert duplicate["description"] == "Original Description"

    # Verify relationships were copied
    if profile_id:
        profile_link = await db.fetchrow(
            "SELECT * FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2",
            data["cohortId"],
            profile_id,
        )
        assert profile_link is not None

    if simulation_id:
        sim_link = await db.fetchrow(
            "SELECT * FROM cohort_simulations WHERE cohort_id = $1 AND simulation_id = $2",
            data["cohortId"],
            simulation_id,
        )
        assert sim_link is not None


async def test_duplicate_cohort_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent cohort."""
    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/cohorts/duplicate",
        json={"cohortId": fake_cohort_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

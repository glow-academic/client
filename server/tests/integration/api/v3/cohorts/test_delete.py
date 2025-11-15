"""Route tests for POST /api/v3/cohorts/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_delete_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a cohort."""
    # Create a cohort first
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Test Cohort', 'Test', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/cohorts/delete",
        json={"cohortId": str(cohort_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Cohort deleted successfully"

    # Verify cohort was deleted
    cohort = await db.fetchrow("SELECT * FROM cohorts WHERE id = $1", cohort_id)
    assert cohort is None


async def test_delete_cohort_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a cohort that is in use."""
    # Create a cohort
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Test Cohort', 'Test', true) RETURNING id"
    )

    # Create a simulation attempt that uses this cohort
    profile_id = await db.fetchval("SELECT id FROM profiles LIMIT 1")
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

    if profile_id and simulation_id:
        # Add profile to cohort
        await db.execute(
            "INSERT INTO cohort_profiles(cohort_id, profile_id, active) "
            "VALUES ($1, $2, true)",
            cohort_id,
            profile_id,
        )

        # Create attempt and link to profile (via attempt_profiles)
        attempt_id = await db.fetchval(
            "INSERT INTO simulation_attempts(simulation_id) VALUES ($1) RETURNING id",
            simulation_id,
        )
        await db.execute(
            "INSERT INTO attempt_profiles(attempt_id, profile_id, active) "
            "VALUES ($1, $2, true)",
            attempt_id,
            profile_id,
        )

        response = await client.post(
            "/api/v3/cohorts/delete",
            json={"cohortId": str(cohort_id)},
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "in use" in data["detail"].lower()


async def test_delete_cohort_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent cohort."""
    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/cohorts/delete",
        json={"cohortId": fake_cohort_id},
    )

    # Delete should succeed even if cohort doesn't exist (no error raised)
    assert response.status_code == 200

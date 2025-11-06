"""Route tests for POST /api/v3/cohorts/add-profiles endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_add_profiles_to_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test adding profiles to a cohort."""
    # Create a cohort
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Test Cohort', 'Test', true) RETURNING id"
    )

    # Get or create profiles
    profile_id1 = await db.fetchval("SELECT id FROM profiles LIMIT 1")
    if not profile_id1:
        profile_id1 = await db.fetchval(
            "INSERT INTO profiles(first_name, last_name, alias, role, active) "
            "VALUES ('Test', 'User1', 'testuser1', 'guest', true) RETURNING id"
        )

    profile_id2 = await db.fetchval(
        "SELECT id FROM profiles WHERE id != $1 LIMIT 1", profile_id1
    )
    if not profile_id2:
        profile_id2 = await db.fetchval(
            "INSERT INTO profiles(first_name, last_name, alias, role, active) "
            "VALUES ('Test', 'User2', 'testuser2', 'guest', true) RETURNING id"
        )

    response = await client.post(
        "/api/v3/cohorts/add-profiles",
        json={
            "cohortId": str(cohort_id),
            "profileIds": [str(profile_id1), str(profile_id2)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert f"Added 2 profile(s)" in data["message"]

    # Verify profiles were added
    profile_link1 = await db.fetchrow(
        "SELECT * FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2",
        cohort_id,
        profile_id1,
    )
    assert profile_link1 is not None

    profile_link2 = await db.fetchrow(
        "SELECT * FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2",
        cohort_id,
        profile_id2,
    )
    assert profile_link2 is not None


async def test_add_profiles_to_cohort_empty_list(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test adding empty list of profiles to a cohort."""
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Test Cohort', 'Test', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/cohorts/add-profiles",
        json={"cohortId": str(cohort_id), "profileIds": []},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "Added 0 profile(s)" in data["message"]


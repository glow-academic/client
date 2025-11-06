"""Route tests for POST /api/v3/cohorts/leave endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_leave_cohort(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test leaving a cohort."""
    profile_id = await get_superadmin_alias(db)

    # Create a cohort
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Test Cohort', 'Test', true) RETURNING id"
    )

    # Add profile to cohort
    await db.execute(
        "INSERT INTO cohort_profiles(cohort_id, profile_id) VALUES ($1, $2)",
        cohort_id,
        profile_id,
    )

    response = await client.post(
        "/api/v3/cohorts/leave",
        json={"cohortId": str(cohort_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Successfully left cohort"

    # Verify profile was removed from cohort
    profile_link = await db.fetchrow(
        "SELECT * FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2",
        cohort_id,
        profile_id,
    )
    assert profile_link is None


async def test_leave_cohort_not_member(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test leaving a cohort when not a member."""
    profile_id = await get_superadmin_alias(db)

    # Create a cohort
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Test Cohort', 'Test', true) RETURNING id"
    )

    # Don't add profile to cohort

    response = await client.post(
        "/api/v3/cohorts/leave",
        json={"cohortId": str(cohort_id), "profileId": profile_id},
    )

    # Should still succeed (idempotent operation)
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True


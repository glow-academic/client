"""Route tests for POST /api/v3/cohorts/detail-with-profiles endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (get_cs_dept_id,  # type: ignore
                                get_superadmin_alias)

pytestmark = pytest.mark.asyncio


async def test_get_cohort_detail_with_profiles(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohort detail with profiles."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a cohort
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Test Cohort', 'Test Description', true) RETURNING id"
    )

    # Link cohort to department
    await db.execute(
        "INSERT INTO cohort_departments(cohort_id, department_id, active) "
        "VALUES ($1, $2, true)",
        cohort_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/cohorts/detail-with-profiles",
        json={
            "cohortId": str(cohort_id),
            "departmentIds": [str(dept_id)],
            "currentProfileId": profile_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "cohort_id" in data
    assert "title" in data
    assert "current_profile_ids" in data
    assert "available_profiles" in data
    assert "cohort_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["available_profiles"], list)
    assert isinstance(data["cohort_mapping"], dict)


async def test_get_cohort_detail_with_profiles_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test cohort detail with profiles raises error for non-existent cohort."""
    profile_id = await get_superadmin_alias(db)
    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/cohorts/detail-with-profiles",
        json={
            "cohortId": fake_cohort_id,
            "departmentIds": [],
            "currentProfileId": profile_id,
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


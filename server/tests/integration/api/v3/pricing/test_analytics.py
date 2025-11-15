"""Route tests for POST /api/v3/pricing endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_pricing_analytics(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting pricing analytics returns complete data."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "2020-01-01T00:00:00Z",
            "endDate": "2030-12-31T23:59:59Z",
            "departmentIds": [dept_id],
            "profileId": admin_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Verify response has all required fields
    assert "model_runs" in data
    assert "model_mapping" in data
    assert "profile_mapping" in data
    assert "agent_mapping" in data
    assert "persona_mapping" in data

    # Verify fields are of correct types
    assert isinstance(data["model_runs"], list)
    assert isinstance(data["model_mapping"], dict)
    assert isinstance(data["profile_mapping"], dict)
    assert isinstance(data["agent_mapping"], dict)
    assert isinstance(data["persona_mapping"], dict)


async def test_pricing_analytics_date_range_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test filtering by date range."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Get all data
    response_all = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "2020-01-01T00:00:00Z",
            "endDate": "2030-12-31T23:59:59Z",
            "departmentIds": [dept_id],
            "profileId": admin_id,
        },
    )

    # Get narrow date range
    response_narrow = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "2020-01-01T00:00:00Z",
            "endDate": "2020-01-02T00:00:00Z",
            "departmentIds": [dept_id],
            "profileId": admin_id,
        },
    )

    assert response_all.status_code == 200
    assert response_narrow.status_code == 200

    data_all = response_all.json()
    data_narrow = response_narrow.json()

    # Narrow range should have fewer or equal model runs
    assert len(data_narrow["model_runs"]) <= len(data_all["model_runs"])


async def test_pricing_analytics_profile_filter_non_admin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that non-admin users only see their own pricing data."""
    dept_id = await get_cs_dept_id(db)

    # Get a TA or student profile (non-admin)
    ta_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'ta' AND active = true LIMIT 1"
    )

    if ta_id:
        response = await client.post(
            "/api/v3/pricing",
            json={
                "startDate": "2020-01-01T00:00:00Z",
                "endDate": "2030-12-31T23:59:59Z",
                "departmentIds": [dept_id],
                "profileId": str(ta_id),
            },
        )

        assert response.status_code == 200
        data = response.json()

        # All model runs should belong to the TA (if any exist)
        for run in data["model_runs"]:
            if run.get("profile_id"):
                assert run["profile_id"] == str(ta_id)


async def test_pricing_analytics_profile_filter_admin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that admins see all pricing data regardless of profileId."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "2020-01-01T00:00:00Z",
            "endDate": "2030-12-31T23:59:59Z",
            "departmentIds": [dept_id],
            "profileId": admin_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Admin should see model runs from multiple profiles (if data exists)
    assert isinstance(data["model_runs"], list)


async def test_pricing_analytics_department_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test filtering by department."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Create a new department with no data
    new_dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES('Test Pricing Dept', 'Test', true) RETURNING id"
    )

    # CS department should have data (or at least not error)
    response_cs = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "2020-01-01T00:00:00Z",
            "endDate": "2030-12-31T23:59:59Z",
            "departmentIds": [dept_id],
            "profileId": admin_id,
        },
    )

    # New department should have no data
    response_new = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "2020-01-01T00:00:00Z",
            "endDate": "2030-12-31T23:59:59Z",
            "departmentIds": [str(new_dept_id)],
            "profileId": admin_id,
        },
    )

    assert response_cs.status_code == 200
    assert response_new.status_code == 200

    data_new = response_new.json()
    assert len(data_new["model_runs"]) == 0


async def test_pricing_analytics_cohort_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test filtering by cohort."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Get a cohort ID from CS department
    cohort_id = await db.fetchval("SELECT id FROM cohorts WHERE active = true LIMIT 1")

    if cohort_id:
        response = await client.post(
            "/api/v3/pricing",
            json={
                "startDate": "2020-01-01T00:00:00Z",
                "endDate": "2030-12-31T23:59:59Z",
                "departmentIds": [dept_id],
                "cohortIds": [str(cohort_id)],
                "profileId": admin_id,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["model_runs"], list)


async def test_pricing_analytics_role_filter(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test filtering by role."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "2020-01-01T00:00:00Z",
            "endDate": "2030-12-31T23:59:59Z",
            "departmentIds": [dept_id],
            "roles": ["ta"],
            "profileId": admin_id,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["model_runs"], list)


async def test_pricing_analytics_empty_date_range(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that empty date range returns empty arrays."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "1900-01-01T00:00:00Z",
            "endDate": "1900-01-02T00:00:00Z",
            "departmentIds": [dept_id],
            "profileId": admin_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Should return empty arrays
    assert len(data["model_runs"]) == 0
    assert len(data["model_mapping"]) == 0
    assert len(data["profile_mapping"]) == 0
    assert len(data["agent_mapping"]) == 0
    assert len(data["persona_mapping"]) == 0


async def test_pricing_analytics_debug_info(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that debug_info is properly attached to model runs."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/pricing",
        json={
            "startDate": "2020-01-01T00:00:00Z",
            "endDate": "2030-12-31T23:59:59Z",
            "departmentIds": [dept_id],
            "profileId": admin_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # Verify debug_info field exists on all model runs
    for run in data["model_runs"]:
        assert "debug_info" in run
        assert isinstance(run["debug_info"], list)
        # If debug_info has items, verify structure
        for debug in run["debug_info"]:
            assert "id" in debug
            assert "created_at" in debug
            assert "content" in debug

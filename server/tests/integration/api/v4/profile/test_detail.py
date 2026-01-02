"""Route tests for POST /api/v4/profile/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateProfileEmailSqlParams,
    CreateProfileEmailSqlRow,
    CreateTestProfileSqlParams,
    CreateTestProfileSqlRow,
    GetProfileByIdSqlParams,
    GetProfileByIdSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_profile_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile by ID."""
    profile_id = await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/detail",
        json={"profile_id": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profile" in data
    profile = data["profile"]
    assert profile["id"] == profile_id
    assert "first_name" in profile
    assert "last_name" in profile
    assert "emails" in profile
    assert "primary_email" in profile
    assert "role" in profile
    assert "active" in profile
    assert "default_profile" in profile
    assert "req_per_day" in profile
    assert "last_login" in profile
    assert "last_active" in profile
    assert "created_at" in profile
    assert "updated_at" in profile
    assert "primary_department_id" in profile


async def test_get_profile_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting non-existent profile."""
    await get_superadmin_alias(db)

    fake_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/detail",
        json={"profile_id": fake_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


async def test_get_profile_detail_with_uuid(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile with actual UUID."""
    await get_superadmin_alias(db)

    # Create a guest profile using SQL file
    guest_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/profile/test_create_test_profile_v4_complete.sql",
        params=CreateTestProfileSqlParams(
            profile_first_name="Guest",
            profile_last_name="User",
            profile_role="guest",
            profile_active=True,
            profile_default_profile=True,
        ),
    )
    typed_guest = CreateTestProfileSqlRow.model_validate(guest_result.model_dump())
    assert typed_guest.profile_id is not None
    guest_id = typed_guest.profile_id

    # Insert email into profile_emails using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/profile/test_create_profile_email_v4_complete.sql",
        params=CreateProfileEmailSqlParams(
            input_profile_id=guest_id,
            email_address="redacted@purdue.edu",
            is_primary=True,
            email_active=True,
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/detail",
        json={"profile_id": str(guest_id)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["profile"]["id"] == str(guest_id)
    assert data["profile"]["role"] == "guest"


async def test_get_profile_detail_invalid_string(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that invalid profile ID strings return error."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/detail",
        json={"profile_id": "invalid-uuid-string"},
    )

    # Should return 400 or 404 for invalid profile ID string
    assert response.status_code in [400, 404]

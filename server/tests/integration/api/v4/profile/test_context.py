"""Route tests for POST /api/v4/profile/_context endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateProfileEmailSqlParams,
    CreateTestProfileSqlParams,
    CreateTestProfileSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_profile_context(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile context."""
    profile_id = await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/_context",
        json={
            "actual_profile_id": profile_id,
            "effective_profile_id": profile_id,
            "pathname": "/home",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "actual_profile" in data
    assert "effective_profile" in data
    assert "departments" in data
    assert "department_ids" in data
    assert "cohorts" in data
    assert "cohort_ids" in data
    assert "simulations" in data
    assert "simulation_ids" in data
    assert "simulatable_profiles" in data
    assert "earliest_attempt_date" in data
    assert "available_sections" in data
    assert "redirect_path" in data

    # Verify profile data
    assert data["actual_profile"]["id"] == profile_id
    assert data["effective_profile"]["id"] == profile_id


async def test_get_profile_context_guest_profile_id(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context with guest profile UUID."""
    await get_superadmin_alias(db)

    # Create a default guest profile using SQL file
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
        "/api/v4/profile/_context",
        json={
            "actual_profile_id": str(guest_id),
            "effective_profile_id": str(guest_id),
            "pathname": "/home",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["effective_profile"]["id"] == str(guest_id)
    assert data["effective_profile"]["role"] == "guest"


async def test_get_profile_context_emulation_authorized(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context with authorized emulation."""
    superadmin_id = await get_superadmin_alias(db)

    # Create a target profile (member role - superadmin can emulate) using SQL file
    target_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/profile/test_create_test_profile_v4_complete.sql",
        params=CreateTestProfileSqlParams(
            profile_first_name="Target",
            profile_last_name="User",
            profile_role="member",
            profile_active=True,
            profile_default_profile=False,
        ),
    )
    typed_target = CreateTestProfileSqlRow.model_validate(target_result.model_dump())
    assert typed_target.profile_id is not None
    target_id = typed_target.profile_id

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/profile/test_create_profile_email_v4_complete.sql",
        params=CreateProfileEmailSqlParams(
            input_profile_id=target_id,
            email_address="redacted@purdue.edu",
            is_primary=True,
            email_active=True,
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/_context",
        json={
            "actual_profile_id": superadmin_id,
            "effective_profile_id": str(target_id),
            "pathname": "/home",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["actual_profile"]["id"] == superadmin_id
    assert data["effective_profile"]["id"] == str(target_id)


async def test_get_profile_context_emulation_unauthorized(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context with unauthorized emulation."""
    await get_superadmin_alias(db)

    # Create a member profile (cannot emulate) using SQL file
    member_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/profile/test_create_test_profile_v4_complete.sql",
        params=CreateTestProfileSqlParams(
            profile_first_name="Member",
            profile_last_name="User",
            profile_role="member",
            profile_active=True,
            profile_default_profile=False,
        ),
    )
    typed_member = CreateTestProfileSqlRow.model_validate(member_result.model_dump())
    assert typed_member.profile_id is not None
    member_id = typed_member.profile_id

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/profile/test_create_profile_email_v4_complete.sql",
        params=CreateProfileEmailSqlParams(
            input_profile_id=member_id,
            email_address="redacted@purdue.edu",
            is_primary=True,
            email_active=True,
        ),
    )

    # Try to emulate superadmin (not allowed)
    superadmin_id = await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/_context",
        json={
            "actual_profile_id": str(member_id),
            "effective_profile_id": superadmin_id,
            "pathname": "/home",
        },
    )

    assert response.status_code == 403
    data = response.json()
    assert "permission" in data["detail"].lower()


async def test_get_profile_context_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test profile context with non-existent profile."""
    profile_id = await get_superadmin_alias(db)
    fake_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/_context",
        json={
            "actual_profile_id": profile_id,
            "effective_profile_id": fake_id,
            "pathname": "/home",
        },
    )

    # When trying to emulate a non-existent profile, authorization check fails first (403)
    # or context fetch fails (404) - either is acceptable
    assert response.status_code in [403, 404]
    data = response.json()
    assert (
        "not found" in data["detail"].lower() or "permission" in data["detail"].lower()
    )

"""Route tests for POST /api/v4/profile/email endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_profile_by_email_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile by non-existent email."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency (optional for this endpoint)
    response = await client.post(
        "/api/v4/profile/email",
        json={"email": "nonexistent@example.com"},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


async def test_get_profile_by_email_from_create(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting profile by email that was just created."""
    await get_superadmin_alias(db)

    email = "lookup@example.com"

    # Create a profile first
    create_response = await client.post(
        "/api/v4/profile/create",
        json={
            "first_name": "Lookup",
            "last_name": "User",
            "emails": [email],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )
    assert create_response.status_code == 200

    # Get profile by email
    response = await client.post(
        "/api/v4/profile/email",
        json={"email": email},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profileId" in data
    assert data["profileId"] is not None
    assert data["first_name"] == "Lookup"
    assert data["last_name"] == "User"


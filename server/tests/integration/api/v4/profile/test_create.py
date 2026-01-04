"""Route tests for POST /api/v4/profile/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_profile(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new profile."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/create",
        json={
            "first_name": "Test",
            "last_name": "User",
            "emails": ["testuser@example.com"],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profileId" in data
    assert data["profileId"] is not None


async def test_create_profile_duplicate_email(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating profile with duplicate email fails."""
    await get_superadmin_alias(db)

    email = "duplicate@example.com"

    # Create first profile
    create_response = await client.post(
        "/api/v4/profile/create",
        json={
            "first_name": "First",
            "last_name": "User",
            "emails": [email],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )
    assert create_response.status_code == 200

    # Try to create second profile with same email
    response = await client.post(
        "/api/v4/profile/create",
        json={
            "first_name": "Second",
            "last_name": "User",
            "emails": [email],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )

    assert response.status_code == 400
    data = response.json()
    assert "already exists" in data["detail"].lower()


async def test_create_profile_no_emails(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating profile without emails fails."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/create",
        json={
            "first_name": "Test",
            "last_name": "User",
            "emails": [],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )

    assert response.status_code == 400
    data = response.json()
    assert "email" in data["detail"].lower()


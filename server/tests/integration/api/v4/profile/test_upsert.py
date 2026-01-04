"""Route tests for POST /api/v4/profile/upsert endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_upsert_profile_create(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test upserting a new profile (create)."""
    await get_superadmin_alias(db)

    email = "upsertcreate@example.com"

    # v4 routes get profile_id from router dependency (optional for upsert)
    response = await client.post(
        "/api/v4/profile/upsert",
        json={
            "first_name": "Upsert",
            "last_name": "Create",
            "emails": [email],
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
    assert data["created"] is True  # Should be created


async def test_upsert_profile_update(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test upserting an existing profile (update)."""
    await get_superadmin_alias(db)

    email = "upsertupdate@example.com"

    # Create a profile first
    create_response = await client.post(
        "/api/v4/profile/create",
        json={
            "first_name": "Original",
            "last_name": "User",
            "emails": [email],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )
    assert create_response.status_code == 200
    create_data = create_response.json()
    profile_id = UUID(create_data["profileId"])

    # Upsert (update) the profile
    response = await client.post(
        "/api/v4/profile/upsert",
        json={
            "first_name": "Updated",
            "last_name": "User",
            "emails": [email],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["profileId"] == str(profile_id)  # Same profile ID
    assert data["created"] is False  # Should be updated, not created


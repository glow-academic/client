"""Route tests for POST /api/v4/profile/delete endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_profile_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent profile."""
    await get_superadmin_alias(db)

    fake_profile_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/delete",
        json={"targetProfileId": fake_profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


async def test_delete_profile_from_create(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a profile that was just created."""
    await get_superadmin_alias(db)

    # Create a profile first
    create_response = await client.post(
        "/api/v4/profile/create",
        json={
            "first_name": "To Delete",
            "last_name": "User",
            "emails": ["todelete@example.com"],
            "primary_email_index": 0,
            "role": "member",
            "cohort_ids": None,
            "department_ids": None,
        },
    )
    assert create_response.status_code == 200
    create_data = create_response.json()
    profile_id = UUID(create_data["profileId"])

    # Delete profile
    response = await client.post(
        "/api/v4/profile/delete",
        json={"targetProfileId": str(profile_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["deleted"] is True


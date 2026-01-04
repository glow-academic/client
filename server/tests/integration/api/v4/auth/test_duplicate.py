"""Route tests for POST /api/v4/auth/duplicate endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_duplicate_auth_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a non-existent auth entry."""
    await get_superadmin_alias(db)

    fake_auth_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/auth/duplicate",
        json={"authId": fake_auth_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


async def test_duplicate_auth_from_list(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating auth from list."""
    await get_superadmin_alias(db)

    # First create an auth entry
    create_response = await client.post(
        "/api/v4/auth/create",
        json={
            "name": "Original Auth",
            "description": "Original Description",
            "active": True,
            "auth_items": [],
        },
    )
    assert create_response.status_code == 200
    create_data = create_response.json()
    auth_id = UUID(create_data["authId"])

    # Duplicate auth
    response = await client.post(
        "/api/v4/auth/duplicate",
        json={"authId": str(auth_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "authId" in data
    assert data["authId"] != str(auth_id)  # Should be a new ID


"""Route tests for POST /api/v4/auth/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_auth_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent auth entry."""
    await get_superadmin_alias(db)

    fake_auth_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/auth/update",
        json={
            "authId": fake_auth_id,
            "name": "Updated Auth",
            "description": "Updated Description",
            "active": True,
            "auth_items": [],
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


async def test_update_auth_from_list(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating auth from list."""
    await get_superadmin_alias(db)

    # First get auth list
    list_response = await client.post(
        "/api/v4/auth/list",
        json={},
    )
    assert list_response.status_code == 200
    list_data = list_response.json()

    if not list_data.get("auth"):
        pytest.skip("No auth entries in seed data")

    auth_id = list_data["auth"][0]["auth_id"]

    # Update auth
    response = await client.post(
        "/api/v4/auth/update",
        json={
            "authId": auth_id,
            "name": "Updated Auth",
            "description": "Updated Description",
            "active": True,
            "auth_items": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True

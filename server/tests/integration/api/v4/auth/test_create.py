"""Route tests for POST /api/v4/auth/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_auth(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new auth entry."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/auth/create",
        json={
            "name": "Test Auth",
            "description": "Test Description",
            "active": True,
            "auth_items": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "success" in data
    assert data["success"] is True
    assert "authId" in data
    assert data["authId"] is not None


async def test_create_auth_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating auth with minimal fields."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/auth/create",
        json={
            "name": "Minimal Auth",
            "description": "",
            "active": True,
            "auth_items": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "authId" in data


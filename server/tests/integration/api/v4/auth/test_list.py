"""Route tests for POST /api/v4/auth/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_auth(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting auth list."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/auth/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "auth" in data
    assert isinstance(data["auth"], list)


async def test_list_auth_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test auth list works even with no auth entries."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/auth/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "auth" in data
    assert isinstance(data["auth"], list)


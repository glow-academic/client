"""Route tests for POST /api/v4/auth/login endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_get_login_data(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting login data with providers and departments."""
    # Login endpoint doesn't require authentication
    response = await client.post(
        "/api/v4/auth/login",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "providers" in data
    assert isinstance(data["providers"], list)
    assert "departments" in data
    assert isinstance(data["departments"], list)
    assert "guest_login_enabled" in data
    assert "show_default_account" in data
    assert "realm_name" in data


async def test_get_login_data_with_department(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting login data with department filter."""
    # Login endpoint doesn't require authentication
    response = await client.post(
        "/api/v4/auth/login",
        json={"department_id": None},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "providers" in data
    assert "departments" in data

"""Route tests for POST /api/v4/profile/simulatable endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_search_simulatable_profiles(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching simulatable profiles."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/simulatable",
        json={
            "query": "",
            "limit_count": 10,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profiles" in data
    assert isinstance(data["profiles"], list)


async def test_search_simulatable_profiles_with_query(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test searching simulatable profiles with query."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/profile/simulatable",
        json={
            "query": "test",
            "limit_count": 10,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profiles" in data
    assert isinstance(data["profiles"], list)


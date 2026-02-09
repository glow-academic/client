"""Route tests for POST /api/v4/artifacts/personas/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_personas(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting personas list."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/personas/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "personas" in data
    assert isinstance(data["personas"], list)
    assert len(data["personas"]) >= 0

    # If there are personas, verify structure
    if data["personas"]:
        for persona in data["personas"]:
            assert "persona_id" in persona
            assert "name" in persona
            assert "color" in persona
            assert "icon" in persona
            assert "active" in persona


async def test_list_personas_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting personas list when no personas exist."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/personas/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["personas"], list)

"""Route tests for POST /api/v4/staff/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_staff(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting staff list."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/staff/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "profiles" in data
    assert isinstance(data["profiles"], list)

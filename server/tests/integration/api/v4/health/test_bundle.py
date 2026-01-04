"""Route tests for POST /api/v4/health/bundle endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_get_health_bundle(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting health bundle."""
    # Health endpoint may not require authentication
    response = await client.post(
        "/api/v4/health/bundle",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    # Should return health status data


"""Route tests for POST /api/v3/analytics/refresh endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_refresh_analytics(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test refreshing analytics materialized view."""
    response = await client.post(
        "/api/v3/analytics/refresh",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["status"] == "success"
    assert "refreshed successfully" in data["message"].lower()

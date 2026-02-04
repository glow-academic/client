"""Route tests for POST /api/v4/artifacts/leaderboard/get endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_leaderboard_artifact_bundle(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test leaderboard artifact response shape with sections + rows."""
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/leaderboard/get",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert "sections" in data
    assert "data" in data
    assert "views" in data
    assert "resources" in data
    assert "primary_color" in data
    assert "accent_color" in data
    assert "total_count" in data

    sections = data["sections"]
    assert "header_metrics" in sections
    assert "rankings" in sections
    assert "accolades" in sections
    assert "trends" in sections
    assert "filters" in sections
    assert "accolade_winners" in sections

    views = data["views"]
    assert "attempt_facts" in views
    assert "chat_facts" in views
    assert "daily_metrics" in views
    assert "profile_metrics" in views

    resources = data["resources"]
    assert "profiles" in resources
    assert "simulations" in resources
    assert "scenarios" in resources

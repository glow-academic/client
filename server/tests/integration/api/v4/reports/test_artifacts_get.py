"""Route tests for POST /api/v4/artifacts/reports/get endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_reports_artifact_bundle(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test reports artifact response shape with sectioned payload."""
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/reports/get",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert "sections" in data
    assert "views" in data
    assert "resources" in data
    assert "total_count" in data

    sections = data["sections"]
    assert "header_metrics" in sections
    assert "overview" in sections
    assert "leaderboard" in sections
    assert "trends" in sections
    assert "history" in sections

    views = data["views"]
    assert "attempt_facts" in views
    assert "chat_facts" in views
    assert "daily_metrics" in views
    assert "profile_metrics" in views

    resources = data["resources"]
    assert "simulations" in resources
    assert "profiles" in resources
    assert "scenarios" in resources
    assert "cohorts" in resources
    assert "personas" in resources
    assert "rubrics" in resources

"""Route tests for POST /api/v4/feedback/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_feedback(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating feedback."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/feedback/create",
        json={
            "message": "Test feedback",
            "type": "bug",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "success" in data
    assert data["success"] is True
    assert "feedbackId" in data
    assert data["feedbackId"] is not None


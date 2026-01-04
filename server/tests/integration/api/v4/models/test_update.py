"""Route tests for POST /api/v4/models/update endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_model_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent model."""
    await get_superadmin_alias(db)

    fake_model_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/models/update",
        json={
            "modelId": fake_model_id,
            "name": "Updated Model",
            "description": "Updated Description",
            "provider_id": None,
            "active": True,
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


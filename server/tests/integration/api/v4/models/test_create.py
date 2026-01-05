"""Route tests for POST /api/v4/models/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_model(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new model."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/models/create",
        json={
            "name": "Test Model",
            "description": "Test Description",
            "provider_id": None,
            "active": True,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "success" in data
    assert data["success"] is True
    assert "modelId" in data
    assert data["modelId"] is not None

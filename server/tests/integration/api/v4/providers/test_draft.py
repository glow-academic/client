"""Route tests for PATCH /api/v4/providers/draft endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_patch_provider_draft_create(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new provider draft."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.patch(
        "/api/v4/providers/draft",
        json={
            "patch": {"name": "Draft Provider", "description": "Draft description"},
            "expected_version": 0,
            "input_draft_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "draftId" in data
    assert data["draftId"] is not None
    assert "newVersion" in data
    assert data["newVersion"] == 1
    assert "draftExists" in data
    assert data["draftExists"] is False  # Newly created

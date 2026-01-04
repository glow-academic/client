"""Route tests for PATCH /api/v4/simulations/draft endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_patch_simulation_draft_create(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new simulation draft."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.patch(
        "/api/v4/simulations/draft",
        json={
            "patch": {"title": "Draft Simulation", "description": "Draft description"},
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


async def test_patch_simulation_draft_update(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating an existing simulation draft."""
    await get_superadmin_alias(db)

    # Create a draft first
    create_response = await client.patch(
        "/api/v4/simulations/draft",
        json={
            "patch": {"title": "Original Draft", "description": "Original"},
            "expected_version": 0,
            "input_draft_id": None,
        },
    )
    assert create_response.status_code == 200
    create_data = create_response.json()
    draft_id = UUID(create_data["draftId"])
    version = create_data["newVersion"]

    # Update the draft
    response = await client.patch(
        "/api/v4/simulations/draft",
        json={
            "patch": {"title": "Updated Draft"},
            "expected_version": version,
            "input_draft_id": str(draft_id),
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["draftId"] == str(draft_id)
    assert data["newVersion"] == version + 1
    assert data["draftExists"] is True  # Already existed


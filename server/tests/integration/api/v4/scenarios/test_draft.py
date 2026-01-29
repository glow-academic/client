"""Route tests for PATCH /api/v4/scenarios/draft endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def _create_name_resource(db: asyncpg.Connection, name: str) -> str:
    row = await db.fetchrow(
        "INSERT INTO names_resource (name, call_id) VALUES ($1, uuidv7()) RETURNING id",
        name,
    )
    if not row:
        raise ValueError("Failed to create name resource")
    return str(row["id"])


async def _create_problem_statement_resource(
    db: asyncpg.Connection, name: str, problem_statement: str
) -> str:
    row = await db.fetchrow(
        "INSERT INTO problem_statements_resource (name, problem_statement, call_id) VALUES ($1, $2, uuidv7()) RETURNING id",
        name,
        problem_statement,
    )
    if not row:
        raise ValueError("Failed to create problem statement resource")
    return str(row["id"])


async def test_patch_scenario_draft_create(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new scenario draft."""
    await get_superadmin_alias(db)
    name_id = await _create_name_resource(db, "Draft Scenario Name")
    problem_statement_id = await _create_problem_statement_resource(
        db, "Draft Problem Statement", "Draft problem"
    )

    # v4 routes get profile_id from router dependency
    response = await client.patch(
        "/api/v4/scenarios/draft",
        json={
            "name_id": name_id,
            "problem_statement_id": problem_statement_id,
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


async def test_patch_scenario_draft_update(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating an existing scenario draft."""
    await get_superadmin_alias(db)
    original_name_id = await _create_name_resource(db, "Original Draft Name")
    updated_name_id = await _create_name_resource(db, "Updated Draft Name")

    # Create a draft first
    create_response = await client.patch(
        "/api/v4/scenarios/draft",
        json={
            "name_id": original_name_id,
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
        "/api/v4/scenarios/draft",
        json={
            "name_id": updated_name_id,
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


async def test_patch_scenario_draft_version_mismatch(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating draft with wrong version creates new draft."""
    await get_superadmin_alias(db)
    original_name_id = await _create_name_resource(db, "Original Draft Name")
    updated_name_id = await _create_name_resource(db, "Updated Draft Name")

    # Create a draft first
    create_response = await client.patch(
        "/api/v4/scenarios/draft",
        json={
            "name_id": original_name_id,
            "expected_version": 0,
            "input_draft_id": None,
        },
    )
    assert create_response.status_code == 200
    create_data = create_response.json()
    draft_id = UUID(create_data["draftId"])

    # Try to update with wrong version
    response = await client.patch(
        "/api/v4/scenarios/draft",
        json={
            "name_id": updated_name_id,
            "expected_version": 999,  # Wrong version
            "input_draft_id": str(draft_id),
        },
    )

    # Should create a new draft due to version mismatch
    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["draftId"] != str(draft_id)  # New draft ID
    assert data["draftExists"] is False  # Newly created

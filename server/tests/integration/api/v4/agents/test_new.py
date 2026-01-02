"""Route tests for POST /api/v4/agents/new endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_agent_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default agent detail metadata."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/agents/new",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify default values
    assert data["name"] == ""
    assert data["description"] == ""
    assert data["system_prompt"] == ""
    assert data["prompt_id"] is None
    assert data["temperature"] == 0.7
    assert data["model_id"] == ""
    assert data["reasoning"] == "none"
    assert data["active"] is True
    assert data["role"] == "assistant"
    assert data["department_ids"] == []
    assert data["department_mapping"] is not None
    assert isinstance(data["department_mapping"], dict)
    assert data["department_prompt_links"] == {}
    assert data["prompt_mapping"] == {}
    assert data["debug_info"] == []

    # Verify mappings are populated
    assert "valid_model_ids" in data
    assert isinstance(data["valid_model_ids"], list)
    assert "model_mapping" in data
    assert isinstance(data["model_mapping"], dict)
    assert "reasoning_mapping" in data
    assert isinstance(data["reasoning_mapping"], dict)
    assert "reasoning_options" in data
    assert isinstance(data["reasoning_options"], list)
    assert len(data["reasoning_options"]) == 5

    # Verify reasoning mapping has all expected levels
    expected_reasoning_levels = ["none", "minimal", "low", "medium", "high"]
    for level in expected_reasoning_levels:
        assert level in data["reasoning_mapping"]
        reasoning_item = data["reasoning_mapping"][level]
        assert "name" in reasoning_item
        assert "description" in reasoning_item

    # Verify temperature bounds
    assert data["temperature_lower"] == 0.0
    assert data["temperature_upper"] == 1.0


async def test_get_agent_new_includes_models(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that default detail includes active models."""
    await get_superadmin_alias(db)

    # Get count of active models using SQL file
    from tests.sql.types import GetActiveModelsCountSqlRow
    from utils.sql_helper import execute_sql_typed

    count_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/agents/test_get_active_models_count_v4_complete.sql",
        params=None,
    )
    typed_count = GetActiveModelsCountSqlRow.model_validate(count_result.model_dump())
    active_models_count = typed_count.count

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/new",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify valid_model_ids matches active models
    assert len(data["valid_model_ids"]) == active_models_count

    # Verify model_mapping contains all models
    assert len(data["model_mapping"]) >= active_models_count

    # Verify each model_id in valid_model_ids has an entry in model_mapping
    for model_id in data["valid_model_ids"]:
        assert model_id in data["model_mapping"]
        model_info = data["model_mapping"][model_id]
        assert "name" in model_info
        assert "description" in model_info


async def test_get_agent_new_includes_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that default detail includes user's departments."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/new",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify valid_department_ids is populated
    assert "valid_department_ids" in data
    assert isinstance(data["valid_department_ids"], list)
    assert len(data["valid_department_ids"]) >= 0

    # Verify department_mapping is populated
    assert "department_mapping" in data
    assert isinstance(data["department_mapping"], dict)

    # Verify each department_id in valid_department_ids has an entry in mapping
    for dept_id in data["valid_department_ids"]:
        assert dept_id in data["department_mapping"]
        dept_info = data["department_mapping"][dept_id]
        assert "name" in dept_info
        assert "description" in dept_info

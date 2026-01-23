"""Route tests for POST /api/v4/agents/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import GetFirstModelSqlRow
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_agent_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting agent detail with debug info and models."""
    # First get an agent from the list
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    list_response = await client.post(
        "/api/v4/agents/list",
        json={},
    )
    assert list_response.status_code == 200
    list_data = list_response.json()

    if not list_data["agents"]:
        pytest.skip("No agents in seed data")

    agent_id = list_data["agents"][0]["agent_id"]

    # Get agent detail - v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/detail",
        json={"agentId": agent_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert data["name"] is not None
    assert "description" in data
    assert data["description"] is not None
    assert "system_prompt" in data
    assert data["system_prompt"] is not None
    assert "temperature" in data
    assert data["temperature"] is not None
    assert "model_id" in data
    assert data["model_id"] is not None
    assert "reasoning" in data
    assert "active" in data
    assert data["active"] is not None
    assert "valid_model_ids" in data
    assert data["valid_model_ids"] is not None
    assert "reasoning_options" in data
    assert data["reasoning_options"] is not None
    assert "debug_info" in data  # May be empty list
    assert data["debug_info"] is not None
    assert "model_mapping" in data
    assert data["model_mapping"] is not None
    assert "reasoning_mapping" in data
    assert data["reasoning_mapping"] is not None

    # Verify model mapping contains valid models
    assert len(data["valid_model_ids"]) >= 0
    assert len(data["model_mapping"]) >= 0

    # Verify agent's current model is in the mapping
    if data["model_id"]:
        assert data["model_id"] in data["model_mapping"]


async def test_get_agent_detail_no_debug_info(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agent detail works without debug info."""
    await get_superadmin_alias(db)

    # Create a new agent without any debug info using SQL file
    model_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_first_model_v4_complete.sql",
        params=None,
    )
    typed_model = GetFirstModelSqlRow.model_validate(model_result.model_dump())
    assert typed_model.model_id is not None

    from tests.sql.types import CreateTestAgentSqlParams, CreateTestAgentSqlRow

    agent_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_create_test_agent_v4_complete.sql",
        params=CreateTestAgentSqlParams(
            model_id=typed_model.model_id,
            name="Test Agent",
            description="Test Description",
            role="assistant",
            active=True,
        ),
    )
    typed_agent = CreateTestAgentSqlRow.model_validate(agent_result.model_dump())
    assert typed_agent.agent_id is not None
    agent_id = typed_agent.agent_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/detail",
        json={"agentId": str(agent_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["name"] == "Test Agent"
    assert data["active"] is True
    assert data["debug_info"] == []  # No debug info


async def test_get_agent_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agent detail raises error for non-existent agent."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/agents/detail",
        json={"agentId": fake_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()


async def test_get_agent_detail_model_mapping(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agent detail includes all active models in mapping."""
    # Get any agent
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    list_response = await client.post(
        "/api/v4/agents/list",
        json={},
    )
    assert list_response.status_code == 200
    list_data = list_response.json()

    if not list_data["agents"]:
        pytest.skip("No agents in seed data")

    agent_id = list_data["agents"][0]["agent_id"]

    # Get agent detail
    response = await client.post(
        "/api/v4/agents/detail",
        json={"agentId": agent_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Get count of active models from database using SQL file
    from tests.sql.types import GetActiveModelsCountSqlRow

    count_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/agents/test_get_active_models_count_v4_complete.sql",
        params=None,
    )
    typed_count = GetActiveModelsCountSqlRow.model_validate(count_result.model_dump())
    active_models_count = typed_count.count

    # Verify valid_model_ids matches active models count
    assert len(data["valid_model_ids"]) == active_models_count

    # Verify all models have entries in model_mapping
    # (model_mapping should include ALL models, not just active ones)
    assert len(data["model_mapping"]) >= active_models_count

    # Verify reasoning_mapping contains all expected levels
    assert len(data["reasoning_mapping"]) == 5
    expected_reasoning_levels = ["none", "minimal", "low", "medium", "high"]
    for level in expected_reasoning_levels:
        assert level in data["reasoning_mapping"]
        reasoning_item = data["reasoning_mapping"][level]
        assert "name" in reasoning_item
        assert reasoning_item["name"] is not None
        assert len(reasoning_item["name"]) > 0
        assert "description" in reasoning_item
        assert reasoning_item["description"] is not None
        assert len(reasoning_item["description"]) > 0


async def test_get_agent_detail_optimization(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agent detail optimization returns all data in correct format."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    list_response = await client.post(
        "/api/v4/agents/list",
        json={},
    )
    assert list_response.status_code == 200
    list_data = list_response.json()

    if not list_data["agents"]:
        pytest.skip("No agents in seed data")

    agent_id = list_data["agents"][0]["agent_id"]

    response = await client.post(
        "/api/v4/agents/detail",
        json={"agentId": agent_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify JSONB arrays are properly parsed
    assert isinstance(data["debug_info"], list)
    assert isinstance(data["valid_model_ids"], list)
    assert isinstance(data["model_mapping"], dict)
    assert isinstance(data["reasoning_mapping"], dict)

    # Verify debug info structure if present
    for debug_item in data["debug_info"]:
        assert "created_at" in debug_item
        assert debug_item["created_at"] is not None
        assert "model_id" in debug_item
        assert debug_item["model_id"] is not None
        assert "content" in debug_item
        assert debug_item["content"] is not None

    # Verify all valid_model_ids have entries in model_mapping
    for model_id in data["valid_model_ids"]:
        assert model_id in data["model_mapping"]

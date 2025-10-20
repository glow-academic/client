"""Real database integration tests for AgentService."""

import asyncpg  # type: ignore
import pytest
from tests.seed_helpers import (
    get_superadmin_alias,  # type: ignore
)

from app.schemas.agents import (
    AgentDetailRequest,  # type: ignore
    AgentsListRequest,  # type: ignore
)
from app.services.agent_service import AgentService  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# READ METHOD TESTS
# ============================================================================


async def test_get_agents_list(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test getting agents list with model mapping."""
    profile_id = await get_superadmin_alias(db)

    svc = AgentService(db)
    result = await svc.get_agents_list(AgentsListRequest(profileId=profile_id))

    assert result is not None
    assert result.agents is not None
    assert result.model_mapping is not None
    assert len(result.agents) >= 0

    # If there are agents, verify model mapping is populated
    if result.agents:
        for agent in result.agents:
            assert agent.agent_id is not None
            assert agent.name is not None
            assert agent.model_id is not None
            # Verify model mapping exists for agent's model
            if agent.model_id:
                assert agent.model_id in result.model_mapping


async def test_get_agents_list_empty_for_new_department(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agents list works even with no agents (system-wide, so should have seed data)."""
    profile_id = await get_superadmin_alias(db)

    svc = AgentService(db)
    result = await svc.get_agents_list(AgentsListRequest(profileId=profile_id))

    # Agents are system-wide, should have seed data
    assert result is not None
    assert result.agents is not None
    assert result.model_mapping is not None


async def test_get_agents_list_permissions_superadmin(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test superadmin has edit/delete permissions."""
    profile_id = await get_superadmin_alias(db)

    svc = AgentService(db)
    result = await svc.get_agents_list(AgentsListRequest(profileId=profile_id))

    assert result is not None
    # Superadmin should have edit and delete permissions
    for agent in result.agents:
        assert agent.can_edit is True
        assert agent.can_delete is True


async def test_get_agents_list_permissions_non_superadmin(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test non-superadmin does not have edit/delete permissions."""
    # Create a non-superadmin profile
    ta_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role) "
        "VALUES('Test', 'TA', 'test_ta_agent', 'ta') RETURNING id"
    )

    svc = AgentService(db)
    result = await svc.get_agents_list(AgentsListRequest(profileId=str(ta_id)))

    assert result is not None
    # TA should not have edit or delete permissions
    for agent in result.agents:
        assert agent.can_edit is False
        assert agent.can_delete is False


async def test_get_agent_detail(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test getting agent detail with debug info and models."""
    # First get an agent from the list
    profile_id = await get_superadmin_alias(db)
    svc = AgentService(db)
    list_result = await svc.get_agents_list(AgentsListRequest(profileId=profile_id))

    if not list_result.agents:
        pytest.skip("No agents in seed data")

    agent_id = list_result.agents[0].agent_id

    # Get agent detail
    result = await svc.get_agent_detail(
        AgentDetailRequest(agentId=agent_id, profileId=profile_id)
    )

    assert result is not None
    assert result.name is not None
    assert result.description is not None
    assert result.system_prompt is not None
    assert result.temperature is not None
    assert result.model_id is not None
    assert result.reasoning is not None
    assert result.valid_model_ids is not None
    assert result.reasoning_options is not None
    assert result.debug_info is not None  # May be empty list
    assert result.model_mapping is not None
    assert result.reasoning_mapping is not None

    # Verify model mapping contains valid models
    assert len(result.valid_model_ids) >= 0
    assert len(result.model_mapping) >= 0

    # Verify agent's current model is in the mapping
    if result.model_id:
        assert result.model_id in result.model_mapping


async def test_get_agent_detail_no_debug_info(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agent detail works without debug info."""
    profile_id = await get_superadmin_alias(db)

    # Create a new agent without any debug info
    agent_id = await db.fetchval(
        "INSERT INTO agents(name, description, system_prompt, temperature, model_id, reasoning) "
        "SELECT 'Test Agent', 'Test Description', 'Test Prompt', 0.7, id, 'none' "
        "FROM models WHERE active = true LIMIT 1 RETURNING id"
    )

    svc = AgentService(db)
    result = await svc.get_agent_detail(
        AgentDetailRequest(agentId=str(agent_id), profileId=profile_id)
    )

    assert result is not None
    assert result.name == "Test Agent"
    assert result.debug_info == []  # No debug info


async def test_get_agent_detail_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agent detail raises error for non-existent agent."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    profile_id = await get_superadmin_alias(db)

    svc = AgentService(db)

    with pytest.raises(ValueError, match="not found"):
        await svc.get_agent_detail(
            AgentDetailRequest(agentId=fake_id, profileId=profile_id)
        )


async def test_get_agent_detail_model_mapping_complete(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test agent detail includes all active models in mapping."""
    # Get any agent
    profile_id = await get_superadmin_alias(db)
    svc = AgentService(db)
    list_result = await svc.get_agents_list(AgentsListRequest(profileId=profile_id))

    if not list_result.agents:
        pytest.skip("No agents in seed data")

    agent_id = list_result.agents[0].agent_id

    # Get agent detail
    result = await svc.get_agent_detail(
        AgentDetailRequest(agentId=agent_id, profileId=profile_id)
    )

    # Get count of active models from database
    active_models_count = await db.fetchval(
        "SELECT COUNT(*) FROM models WHERE active = true"
    )

    # Verify valid_model_ids matches active models count
    assert len(result.valid_model_ids) == active_models_count

    # Verify all models have entries in model_mapping
    # (model_mapping should include ALL models, not just active ones)
    assert len(result.model_mapping) >= active_models_count

    # Verify reasoning_mapping contains all expected levels
    assert len(result.reasoning_mapping) == 5
    expected_reasoning_levels = ["none", "minimal", "low", "medium", "high"]
    for level in expected_reasoning_levels:
        assert level in result.reasoning_mapping
        reasoning_item = result.reasoning_mapping[level]
        assert reasoning_item.name is not None
        assert len(reasoning_item.name) > 0
        assert reasoning_item.description is not None
        assert len(reasoning_item.description) > 0


async def test_agents_list_single_query_optimization(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agents list optimization works correctly with model info."""
    profile_id = await get_superadmin_alias(db)

    svc = AgentService(db)
    result = await svc.get_agents_list(AgentsListRequest(profileId=profile_id))

    assert result is not None

    # Verify each agent has a model_id and it's in the mapping
    for agent in result.agents:
        if agent.model_id:  # Some agents might not have a model
            model_info = result.model_mapping.get(agent.model_id)
            assert model_info is not None
            assert model_info.name is not None
            # Description might be empty string, but should exist
            assert model_info.description is not None


async def test_agent_detail_single_query_optimization(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agent detail optimization returns all data in correct format."""
    profile_id = await get_superadmin_alias(db)
    svc = AgentService(db)
    list_result = await svc.get_agents_list(AgentsListRequest(profileId=profile_id))

    if not list_result.agents:
        pytest.skip("No agents in seed data")

    agent_id = list_result.agents[0].agent_id
    result = await svc.get_agent_detail(
        AgentDetailRequest(agentId=agent_id, profileId=profile_id)
    )

    # Verify JSONB arrays are properly parsed
    assert isinstance(result.debug_info, list)
    assert isinstance(result.valid_model_ids, list)
    assert isinstance(result.model_mapping, dict)
    assert isinstance(result.reasoning_mapping, dict)

    # Verify debug info structure if present
    for debug_item in result.debug_info:
        assert debug_item.created_at is not None
        assert debug_item.model_id is not None
        assert debug_item.content is not None

    # Verify all valid_model_ids have entries in model_mapping
    for model_id in result.valid_model_ids:
        assert model_id in result.model_mapping

"""Tests for infra.system_context — system resource chain hydration.

resolve_system_context is tested with mocked black-box fetchers.
Tests verify: correct IDs flow to correct fetchers, dedup, and edge cases.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.system_context import SystemContext, resolve_system_context


MODULE = "app.infra.system_context"


# ── Helpers ──────────────────────────────────────────────────────────────────


class FakeSystem:
    def __init__(self, *, system_id=None, agent_ids=None):
        self.id = system_id or uuid4()
        self.agent_ids = agent_ids or []


class FakeAgent:
    def __init__(self, *, agent_id=None, model_id=None, tool_ids=None, prompt_id=None, instruction_ids=None):
        self.id = agent_id or uuid4()
        self.model_id = model_id
        self.tool_ids = tool_ids or []
        self.prompt_id = prompt_id
        self.instruction_ids = instruction_ids or []


class FakeModel:
    def __init__(self, *, model_id=None, provider_id=None):
        self.id = model_id or uuid4()
        self.provider_id = provider_id


class FakeTool:
    def __init__(self, *, tool_id=None, args_ids=None, args_output_ids=None):
        self.id = tool_id or uuid4()
        self.args_ids = args_ids or []
        self.args_output_ids = args_output_ids or []


def _patch(target, return_value):
    return patch(f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value)


# ═══════════════════════════════════════════════════════════════════════════
# resolve_system_context
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveSystemContextEmpty:
    async def test_system_not_found_returns_none(self):
        system_id = uuid4()
        with _patch("get_systems", []) as mock_sys:
            result = await resolve_system_context(None, None, system_id=system_id)

        assert result is None
        # Verify correct system_id was requested
        assert mock_sys.call_args[0][1] == [system_id]

    async def test_system_no_agents_returns_empty(self):
        system_id = uuid4()
        system = FakeSystem(system_id=system_id, agent_ids=[])

        with _patch("get_systems", [system]):
            result = await resolve_system_context(None, None, system_id=system_id)

        assert result is not None
        assert result.system_id == system_id
        assert result.agents == []
        assert result.models == []
        assert result.providers == []
        assert result.tools == []
        assert result.args == []
        assert result.args_outputs == []
        assert result.prompts == []
        assert result.instructions == []


@pytest.mark.asyncio
class TestResolveSystemContextCallArgs:
    """Verify each fetcher receives the correct IDs from the previous level."""

    async def test_full_chain_ids_flow(self):
        """system → agent_ids → model_id/tool_ids/prompt_id/instruction_ids → provider_id/args_ids/args_output_ids."""
        system_id = uuid4()
        agent_id = uuid4()
        model_id = uuid4()
        tool_id = uuid4()
        prompt_id = uuid4()
        instruction_id = uuid4()
        provider_id = uuid4()
        arg_id = uuid4()
        arg_output_id = uuid4()

        system = FakeSystem(system_id=system_id, agent_ids=[agent_id])
        agent = FakeAgent(
            agent_id=agent_id, model_id=model_id, tool_ids=[tool_id],
            prompt_id=prompt_id, instruction_ids=[instruction_id],
        )
        model = FakeModel(model_id=model_id, provider_id=provider_id)
        tool = FakeTool(tool_id=tool_id, args_ids=[arg_id], args_output_ids=[arg_output_id])
        provider = object()
        arg = object()
        arg_output = object()
        prompt = object()
        instruction = object()

        with (
            _patch("get_systems", [system]) as mock_sys,
            _patch("get_agents", [agent]) as mock_agents,
            _patch("get_models", [model]) as mock_models,
            _patch("get_tools", [tool]) as mock_tools,
            _patch("get_prompts", [prompt]) as mock_prompts,
            _patch("get_instructions", [instruction]) as mock_instructions,
            _patch("get_providers", [provider]) as mock_providers,
            _patch("get_args", [arg]) as mock_args,
            _patch("get_args_outputs", [arg_output]) as mock_args_out,
        ):
            result = await resolve_system_context(None, None, system_id=system_id)

        # Step 1: get_systems called with [system_id]
        assert mock_sys.call_args[0][1] == [system_id]

        # Step 2: get_agents called with agent_ids from system
        assert mock_agents.call_args[0][1] == [agent_id]

        # Step 3: get_models/tools/prompts/instructions called with IDs from agents
        assert set(mock_models.call_args[0][1]) == {model_id}
        assert set(mock_tools.call_args[0][1]) == {tool_id}
        assert set(mock_prompts.call_args[0][1]) == {prompt_id}
        assert set(mock_instructions.call_args[0][1]) == {instruction_id}

        # Step 4: get_providers/args/args_outputs called with IDs from models/tools
        assert set(mock_providers.call_args[0][1]) == {provider_id}
        assert set(mock_args.call_args[0][1]) == {arg_id}
        assert set(mock_args_out.call_args[0][1]) == {arg_output_id}

        # Return values assembled correctly
        assert result.agents == [agent]
        assert result.models == [model]
        assert result.providers == [provider]
        assert result.tools == [tool]
        assert result.args == [arg]
        assert result.args_outputs == [arg_output]
        assert result.prompts == [prompt]
        assert result.instructions == [instruction]

    async def test_multiple_agents_dedup_model_ids(self):
        """Two agents sharing the same model — get_models called with 1 ID, not 2."""
        system_id = uuid4()
        model_id = uuid4()
        agent1 = FakeAgent(model_id=model_id, tool_ids=[])
        agent2 = FakeAgent(model_id=model_id, tool_ids=[])
        system = FakeSystem(system_id=system_id, agent_ids=[agent1.id, agent2.id])
        model = FakeModel(model_id=model_id, provider_id=None)

        with (
            _patch("get_systems", [system]),
            _patch("get_agents", [agent1, agent2]) as mock_agents,
            _patch("get_models", [model]) as mock_models,
            _patch("get_tools", []),
            _patch("get_prompts", []),
            _patch("get_instructions", []),
            _patch("get_providers", []),
            _patch("get_args", []),
            _patch("get_args_outputs", []),
        ):
            result = await resolve_system_context(None, None, system_id=system_id)

        # get_agents called with both IDs
        assert set(mock_agents.call_args[0][1]) == {agent1.id, agent2.id}
        # get_models called with deduplicated model_id (1, not 2)
        assert mock_models.call_args[0][1] == [model_id]
        assert result.models == [model]

    async def test_multiple_agents_dedup_prompt_and_instruction_ids(self):
        """Two agents sharing a prompt — get_prompts called with 1 ID, not 2."""
        system_id = uuid4()
        shared_prompt_id = uuid4()
        shared_instruction_id = uuid4()
        unique_instruction_id = uuid4()
        agent1 = FakeAgent(prompt_id=shared_prompt_id, instruction_ids=[shared_instruction_id])
        agent2 = FakeAgent(prompt_id=shared_prompt_id, instruction_ids=[shared_instruction_id, unique_instruction_id])
        system = FakeSystem(system_id=system_id, agent_ids=[agent1.id, agent2.id])

        with (
            _patch("get_systems", [system]),
            _patch("get_agents", [agent1, agent2]),
            _patch("get_models", []),
            _patch("get_tools", []),
            _patch("get_prompts", []) as mock_prompts,
            _patch("get_instructions", []) as mock_instructions,
            _patch("get_providers", []),
            _patch("get_args", []),
            _patch("get_args_outputs", []),
        ):
            await resolve_system_context(None, None, system_id=system_id)

        # Deduped: 1 unique prompt ID, 2 unique instruction IDs
        assert mock_prompts.call_args[0][1] == [shared_prompt_id]
        assert set(mock_instructions.call_args[0][1]) == {shared_instruction_id, unique_instruction_id}

    async def test_multiple_tools_dedup_args_and_outputs(self):
        """Two tools sharing args — get_args/get_args_outputs called with deduped IDs."""
        system_id = uuid4()
        shared_arg_id = uuid4()
        shared_output_id = uuid4()
        unique_arg_id = uuid4()
        tool1 = FakeTool(args_ids=[shared_arg_id, unique_arg_id], args_output_ids=[shared_output_id])
        tool2 = FakeTool(args_ids=[shared_arg_id], args_output_ids=[shared_output_id])
        agent = FakeAgent(model_id=None, tool_ids=[tool1.id, tool2.id])
        system = FakeSystem(system_id=system_id, agent_ids=[agent.id])

        with (
            _patch("get_systems", [system]),
            _patch("get_agents", [agent]),
            _patch("get_models", []),
            _patch("get_tools", [tool1, tool2]),
            _patch("get_prompts", []),
            _patch("get_instructions", []),
            _patch("get_providers", []),
            _patch("get_args", []) as mock_args,
            _patch("get_args_outputs", []) as mock_args_out,
        ):
            await resolve_system_context(None, None, system_id=system_id)

        # Deduped: 2 unique arg IDs, 1 unique output ID
        assert set(mock_args.call_args[0][1]) == {shared_arg_id, unique_arg_id}
        assert set(mock_args_out.call_args[0][1]) == {shared_output_id}

    async def test_agent_no_model_skips_model_fetch(self):
        """Agent with model_id=None — get_models not called."""
        system_id = uuid4()
        agent = FakeAgent(model_id=None, tool_ids=[])
        system = FakeSystem(system_id=system_id, agent_ids=[agent.id])

        with (
            _patch("get_systems", [system]),
            _patch("get_agents", [agent]),
            _patch("get_models", []) as mock_models,
            _patch("get_tools", []) as mock_tools,
            _patch("get_prompts", []),
            _patch("get_instructions", []),
            _patch("get_providers", []),
            _patch("get_args", []),
            _patch("get_args_outputs", []),
        ):
            result = await resolve_system_context(None, None, system_id=system_id)

        # Empty model_ids → _empty() used instead of get_models
        assert mock_models.call_count == 0
        assert mock_tools.call_count == 0
        assert result.agents == [agent]
        assert result.models == []
        assert result.tools == []

    async def test_agent_no_prompt_skips_prompt_fetch(self):
        """Agent with prompt_id=None — get_prompts not called."""
        system_id = uuid4()
        agent = FakeAgent(model_id=None, tool_ids=[], prompt_id=None, instruction_ids=[])
        system = FakeSystem(system_id=system_id, agent_ids=[agent.id])

        with (
            _patch("get_systems", [system]),
            _patch("get_agents", [agent]),
            _patch("get_models", []),
            _patch("get_tools", []),
            _patch("get_prompts", []) as mock_prompts,
            _patch("get_instructions", []) as mock_instructions,
            _patch("get_providers", []),
            _patch("get_args", []),
            _patch("get_args_outputs", []),
        ):
            result = await resolve_system_context(None, None, system_id=system_id)

        assert mock_prompts.call_count == 0
        assert mock_instructions.call_count == 0
        assert result.prompts == []
        assert result.instructions == []

    async def test_tool_no_args_skips_args_fetch(self):
        """Tool with empty args_ids — get_args not called."""
        system_id = uuid4()
        tool = FakeTool(args_ids=[], args_output_ids=[])
        agent = FakeAgent(model_id=None, tool_ids=[tool.id])
        system = FakeSystem(system_id=system_id, agent_ids=[agent.id])

        with (
            _patch("get_systems", [system]),
            _patch("get_agents", [agent]),
            _patch("get_models", []),
            _patch("get_tools", [tool]),
            _patch("get_prompts", []),
            _patch("get_instructions", []),
            _patch("get_providers", []),
            _patch("get_args", []) as mock_args,
            _patch("get_args_outputs", []) as mock_args_out,
        ):
            result = await resolve_system_context(None, None, system_id=system_id)

        assert mock_args.call_count == 0
        assert mock_args_out.call_count == 0
        assert result.tools == [tool]
        assert result.args == []
        assert result.args_outputs == []

    async def test_model_no_provider_skips_provider_fetch(self):
        """Model with provider_id=None — get_providers not called."""
        system_id = uuid4()
        model = FakeModel(model_id=uuid4(), provider_id=None)
        agent = FakeAgent(model_id=model.id, tool_ids=[])
        system = FakeSystem(system_id=system_id, agent_ids=[agent.id])

        with (
            _patch("get_systems", [system]),
            _patch("get_agents", [agent]),
            _patch("get_models", [model]),
            _patch("get_tools", []),
            _patch("get_prompts", []),
            _patch("get_instructions", []),
            _patch("get_providers", []) as mock_providers,
            _patch("get_args", []),
            _patch("get_args_outputs", []),
        ):
            result = await resolve_system_context(None, None, system_id=system_id)

        assert mock_providers.call_count == 0
        assert result.models == [model]
        assert result.providers == []

    async def test_isinstance_system_context(self):
        system_id = uuid4()
        system = FakeSystem(system_id=system_id, agent_ids=[])

        with _patch("get_systems", [system]):
            result = await resolve_system_context(None, None, system_id=system_id)

        assert isinstance(result, SystemContext)

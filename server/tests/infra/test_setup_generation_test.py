"""Tests for infra.websocket.setup_generation_test.

setup_generation_test is tested with mocked black-box entry creators.
Tests verify: correct params flow to create_test / create_test_invocation /
create_test_invocation_runs, and the result structure is correct.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.websocket.setup_generation_test import (
    AgentTestConfig,
    GenerationTestResult,
    setup_generation_test,
)

MODULE = "app.infra.websocket.setup_generation_test"


def _fake_create_response(entry_id=None):
    """Return a mock with .id attribute."""
    mock = AsyncMock()
    mock.id = entry_id or uuid4()
    return mock


def _patch_create_test(test_id=None):
    resp = _fake_create_response(test_id)
    return patch(f"{MODULE}.create_test", new_callable=AsyncMock, return_value=resp)


def _patch_create_invocation(invocation_ids=None):
    """Patch create_test_invocation to return different IDs per call."""
    ids = list(invocation_ids or [])
    idx = {"i": 0}

    async def side_effect(*args, **kwargs):
        if idx["i"] < len(ids):
            resp = _fake_create_response(ids[idx["i"]])
            idx["i"] += 1
            return resp
        return _fake_create_response()

    return patch(f"{MODULE}.create_test_invocation", side_effect=side_effect)


def _patch_create_runs():
    resp = _fake_create_response()
    return patch(
        f"{MODULE}.create_test_invocation_runs",
        new_callable=AsyncMock,
        return_value=resp,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestSetupGenerationTestBasic:
    async def test_empty_agents_raises(self):
        with pytest.raises(ValueError, match="at least one agent"):
            await setup_generation_test(None, agents=[], run_id=uuid4())

    async def test_single_agent_creates_test_and_invocation(self):
        test_id = uuid4()
        inv_id = uuid4()
        agent_id = uuid4()
        rubric_id = uuid4()
        run_id = uuid4()

        agent = AgentTestConfig(agent_id=agent_id, rubric_id=rubric_id)

        with (
            _patch_create_test(test_id) as mock_test,
            _patch_create_invocation([inv_id]) as mock_inv,
            _patch_create_runs() as mock_runs,
        ):
            result = await setup_generation_test(None, agents=[agent], run_id=run_id)

        assert isinstance(result, GenerationTestResult)
        assert result.test_id == test_id
        assert result.invocations == {agent_id: inv_id}

        # create_test called with correct params
        mock_test.assert_called_once()
        call_kwargs = mock_test.call_args[1]
        assert call_kwargs["num_invocations"] == 1
        assert call_kwargs["infinite_mode"] is False

        # create_test_invocation called with agent + rubric
        mock_inv.assert_called_once()
        inv_kwargs = mock_inv.call_args[1]
        assert inv_kwargs["test_id"] == test_id
        assert inv_kwargs["agent_ids"] == [agent_id]
        assert inv_kwargs["rubric_ids"] == [rubric_id]

        # create_test_invocation_runs called with run_id + agent
        mock_runs.assert_called_once()
        runs_kwargs = mock_runs.call_args[1]
        assert runs_kwargs["test_invocation_id"] == inv_id
        assert runs_kwargs["agent_ids"] == [agent_id]
        assert runs_kwargs["run_ids"] == [run_id]

    async def test_multiple_agents_creates_invocation_per_agent(self):
        test_id = uuid4()
        inv_id_1 = uuid4()
        inv_id_2 = uuid4()
        agent_1 = AgentTestConfig(agent_id=uuid4(), rubric_id=uuid4())
        agent_2 = AgentTestConfig(agent_id=uuid4(), rubric_id=uuid4())
        run_id = uuid4()

        with (
            _patch_create_test(test_id) as mock_test,
            _patch_create_invocation([inv_id_1, inv_id_2]) as mock_inv,
            _patch_create_runs() as mock_runs,
        ):
            result = await setup_generation_test(
                None, agents=[agent_1, agent_2], run_id=run_id
            )

        assert result.test_id == test_id
        assert result.invocations[agent_1.agent_id] == inv_id_1
        assert result.invocations[agent_2.agent_id] == inv_id_2

        # num_invocations = 2
        assert mock_test.call_args[1]["num_invocations"] == 2

        # 2 invocations + 2 runs created
        assert mock_inv.call_count == 2
        assert mock_runs.call_count == 2


@pytest.mark.asyncio
class TestSetupGenerationTestConfig:
    async def test_agent_config_flows_to_invocation(self):
        """Verify all agent config fields flow to the correct create calls."""
        dept_ids = [uuid4()]
        voice_ids = [uuid4()]
        reasoning_ids = [uuid4()]
        temp_ids = [uuid4()]
        quality_ids = [uuid4()]
        prompt_ids = [uuid4()]
        instruction_ids = [uuid4()]
        tool_ids = [uuid4()]

        agent = AgentTestConfig(
            agent_id=uuid4(),
            rubric_id=uuid4(),
            department_ids=dept_ids,
            voice_ids=voice_ids,
            reasoning_level_ids=reasoning_ids,
            temperature_level_ids=temp_ids,
            quality_ids=quality_ids,
            prompt_ids=prompt_ids,
            instruction_ids=instruction_ids,
            tool_ids=tool_ids,
        )

        with (
            _patch_create_test(),
            _patch_create_invocation([uuid4()]) as mock_inv,
            _patch_create_runs() as mock_runs,
        ):
            await setup_generation_test(None, agents=[agent], run_id=uuid4())

        # Invocation-level config
        inv_kwargs = mock_inv.call_args[1]
        assert inv_kwargs["department_ids"] == dept_ids
        assert inv_kwargs["voice_ids"] == voice_ids
        assert inv_kwargs["reasoning_level_ids"] == reasoning_ids
        assert inv_kwargs["temperature_level_ids"] == temp_ids
        assert inv_kwargs["quality_ids"] == quality_ids

        # Runs-level config
        runs_kwargs = mock_runs.call_args[1]
        assert runs_kwargs["prompt_ids"] == prompt_ids
        assert runs_kwargs["instruction_ids"] == instruction_ids
        assert runs_kwargs["tool_ids"] == tool_ids

    async def test_profile_id_passed_to_create_test(self):
        profile_id = uuid4()
        agent = AgentTestConfig(agent_id=uuid4(), rubric_id=uuid4())

        with (
            _patch_create_test() as mock_test,
            _patch_create_invocation([uuid4()]),
            _patch_create_runs(),
        ):
            await setup_generation_test(
                None, agents=[agent], run_id=uuid4(), profile_id=profile_id
            )

        assert mock_test.call_args[1]["profiles_id"] == profile_id

    async def test_none_config_fields_passed_as_none(self):
        """Agent with no optional config — None values pass through."""
        agent = AgentTestConfig(agent_id=uuid4(), rubric_id=uuid4())

        with (
            _patch_create_test(),
            _patch_create_invocation([uuid4()]) as mock_inv,
            _patch_create_runs() as mock_runs,
        ):
            await setup_generation_test(None, agents=[agent], run_id=uuid4())

        inv_kwargs = mock_inv.call_args[1]
        assert inv_kwargs["department_ids"] is None
        assert inv_kwargs["voice_ids"] is None

        runs_kwargs = mock_runs.call_args[1]
        assert runs_kwargs["prompt_ids"] is None
        assert runs_kwargs["instruction_ids"] is None
        assert runs_kwargs["tool_ids"] is None

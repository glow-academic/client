"""
Tests for app.utils.agent_helpers
"""

import uuid
from typing import Any

import pytest
from app.utils.agent_helpers import (
    build_guardrail_agent,
    build_hint_agent,
    emit_grading_progress,
    emit_hint_progress,
    get_input_guardrails,
    get_output_guardrails,
    run_guardrail_evaluation,
)


class TestEmit_Grading_Progress:
    """Tests for emit_grading_progress function."""

    @pytest.mark.asyncio
    async def test_emit_grading_progress_with_sio_instance(self) -> None:
        """Test emitting grading progress with Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting grading"}

        class MockSIO:
            async def emit(self, event: str, data: dict[str, Any], room: str) -> None:
                self.last_event = event
                self.last_data = data
                self.last_room = room

        sio_instance = MockSIO()
        await emit_grading_progress(event_data, sio_instance, chat_id)

        assert sio_instance.last_event == "simulation_grading_progress"
        assert sio_instance.last_data == event_data
        assert sio_instance.last_room == f"simulation_{chat_id}"

    @pytest.mark.asyncio
    async def test_emit_grading_progress_without_sio_instance(self) -> None:
        """Test emitting grading progress without Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting grading"}

        # Should not raise an error
        await emit_grading_progress(event_data, None, chat_id)


class TestEmit_Hint_Progress:
    """Tests for emit_hint_progress function."""

    @pytest.mark.asyncio
    async def test_emit_hint_progress_with_sio_instance(self) -> None:
        """Test emitting hint progress with Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting hint generation"}

        class MockSIO:
            async def emit(self, event: str, data: dict[str, Any], room: str) -> None:
                self.last_event = event
                self.last_data = data
                self.last_room = room

        sio_instance = MockSIO()
        await emit_hint_progress(event_data, sio_instance, chat_id)

        assert sio_instance.last_event == "hint_generation_progress"
        assert sio_instance.last_data == event_data
        assert sio_instance.last_room == f"simulation_{chat_id}"

    @pytest.mark.asyncio
    async def test_emit_hint_progress_without_sio_instance(self) -> None:
        """Test emitting hint progress without Socket.IO instance."""
        chat_id = uuid.uuid4()
        event_data = {"type": "start", "message": "Starting hint generation"}

        # Should not raise an error
        await emit_hint_progress(event_data, None, chat_id)


class TestBuild_Hint_Agent:
    """Tests for build_hint_agent function."""

    def test_build_hint_agent_creates_agent(self) -> None:
        """Test that build_hint_agent creates a GenericAgent."""
        context = {
            "agent_name": "Test Agent",
            "system_prompt": "You are a helpful assistant",
            "temperature": 0.7,
            "model_name": "gpt-4",
            "provider_name": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "test-key",
            "reasoning": None,
            "custom_model": None,
        }

        agent = build_hint_agent(context)
        assert agent is not None
        assert agent.agent_name == "Test Agent"


class TestBuild_Guardrail_Agent:
    """Tests for build_guardrail_agent function."""

    def test_build_guardrail_agent_creates_agent(self) -> None:
        """Test that build_guardrail_agent creates a GenericAgent."""
        context = {
            "agent_name": "Guardrail Agent",
            "system_prompt": "You are a guardrail evaluator",
            "temperature": 0.5,
            "model_name": "gpt-4",
            "provider_name": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "test-key",
            "reasoning": None,
            "custom_model": None,
        }

        agent = build_guardrail_agent(context)
        assert agent is not None
        assert agent.agent_name == "Guardrail Agent"


class TestGet_Input_Guardrails:
    """Tests for get_input_guardrails function."""

    def test_get_input_guardrails_returns_list(self) -> None:
        """Test that get_input_guardrails returns a list."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()
        input_items: list[Any] = []

        # Mock connection - we can't easily test the full async flow without DB
        class MockConn:
            pass

        conn = MockConn()  # type: ignore

        # This will fail at runtime without proper DB setup, but tests structure
        guardrails = get_input_guardrails(chat_id, department_id, input_items, conn)
        assert isinstance(guardrails, list)


class TestGet_Output_Guardrails:
    """Tests for get_output_guardrails function."""

    def test_get_output_guardrails_returns_list(self) -> None:
        """Test that get_output_guardrails returns a list."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()
        input_items: list[Any] = []

        # Mock connection - we can't easily test the full async flow without DB
        class MockConn:
            pass

        conn = MockConn()  # type: ignore

        # This will fail at runtime without proper DB setup, but tests structure
        guardrails = get_output_guardrails(chat_id, department_id, input_items, conn)
        assert isinstance(guardrails, list)


"""
Tests for app.utils.agent_helpers
"""

import uuid
from typing import Any
from unittest.mock import patch

import pytest
from app.utils.agents.build_guardrail_agent import build_guardrail_agent
from app.utils.agents.build_hint_agent import build_hint_agent
from app.utils.agents.get_input_guardrails import get_input_guardrails
from app.utils.agents.get_output_guardrails import get_output_guardrails
from app.utils.agents.run_guardrail_evaluation import run_guardrail_evaluation
from app.utils.agents.tools.create_guardrail_tools import \
    create_guardrail_tools
from app.utils.agents.tools.create_hint_tools import create_hint_tools


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

        hint_tools = create_hint_tools()
        # Mock decrypt_api_key to avoid base64 decoding errors
        with patch("app.utils.agents.generic_agent.decrypt_api_key", return_value="decrypted-key"):
            agent = build_hint_agent(context, hint_tools)
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

        guardrail_tools = create_guardrail_tools()
        # Mock decrypt_api_key to avoid base64 decoding errors
        with patch("app.utils.agents.generic_agent.decrypt_api_key", return_value="decrypted-key"):
            agent = build_guardrail_agent(context, guardrail_tools)
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

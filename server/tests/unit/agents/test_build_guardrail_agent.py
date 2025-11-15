"""
Tests for app.utils.agents.build_guardrail_agent
"""

from typing import Any
from unittest.mock import patch

import pytest
from app.utils.agents.build_guardrail_agent import build_guardrail_agent
from app.utils.agents.tools.create_guardrail_tools import create_guardrail_tools


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
        with patch(
            "app.utils.agents.generic_agent.decrypt_api_key", return_value="decrypted-key"
        ):
            agent = build_guardrail_agent(context, guardrail_tools)
            assert agent is not None
            assert agent.agent_name == "Guardrail Agent"


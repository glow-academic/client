"""
Tests for app.utils.agents.build_hint_agent
"""

from unittest.mock import patch

from app.infra.agents.utils.build_hint_agent import build_hint_agent
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
        with patch(
            "app.utils.agents.generic_agent.decrypt_api_key",
            return_value="decrypted-key",
        ):
            agent = build_hint_agent(context, hint_tools)
            assert agent is not None
            assert agent.agent_name == "Test Agent"

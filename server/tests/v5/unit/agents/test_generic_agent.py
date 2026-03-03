"""Unit tests for app.v5.infra.agents.generic_agent."""

from unittest.mock import MagicMock, patch


class TestGenericAgent:
    """Tests for GenericAgent class."""

    def test_generic_agent_initialization(self) -> None:
        """Test GenericAgent initialization."""
        with patch(
            "app.v5.infra.agents.generic_agent.decrypt_api_key",
            return_value="decrypted_key",
        ):
            from app.v5.infra.agents.generic_agent import GenericAgent

            agent = GenericAgent(
                agent_name="test_agent",
                system_prompt="Test prompt",
                temperature=0.7,
                model_name="gpt-4",
                provider="openai",
                api_key="test_key",
                base_url=None,
                reasoning=None,
            )

            assert agent.agent_name == "test_agent"
            assert agent.system_prompt == "Test prompt"
            assert agent.temperature == 0.7
            assert agent.model_name == "gpt-4"
            assert agent.provider == "openai"

    def test_generic_agent_with_tools(self) -> None:
        """Test GenericAgent initialization with tools."""
        mock_tool = MagicMock()

        with patch(
            "app.v5.infra.agents.generic_agent.decrypt_api_key",
            return_value="decrypted_key",
        ):
            from app.v5.infra.agents.generic_agent import GenericAgent

            agent = GenericAgent(
                agent_name="test_agent",
                system_prompt="Test prompt",
                temperature=0.7,
                model_name="gpt-4",
                provider="openai",
                api_key="test_key",
                base_url=None,
                reasoning=None,
                tools=[mock_tool],
            )

            assert agent.tools is not None
            assert len(agent.tools) == 1

    def test_generic_agent_with_reasoning(self) -> None:
        """Test GenericAgent initialization with reasoning."""
        with patch(
            "app.v5.infra.agents.generic_agent.decrypt_api_key",
            return_value="decrypted_key",
        ):
            from app.v5.infra.agents.generic_agent import GenericAgent

            agent = GenericAgent(
                agent_name="test_agent",
                system_prompt="Test prompt",
                temperature=0.7,
                model_name="gpt-4",
                provider="openai",
                api_key="test_key",
                base_url=None,
                reasoning="high",
            )

            assert agent.reasoning == "high"

    def test_get_system_prompt(self) -> None:
        """Test GenericAgent.get_system_prompt() method."""
        with patch(
            "app.v5.infra.agents.generic_agent.decrypt_api_key",
            return_value="decrypted_key",
        ):
            from app.v5.infra.agents.generic_agent import GenericAgent

            agent = GenericAgent(
                agent_name="test_agent",
                system_prompt="Test prompt",
                temperature=0.7,
                model_name="gpt-4",
                provider="openai",
                api_key="test_key",
                base_url=None,
                reasoning=None,
            )

            system_prompt = agent.get_system_prompt()

            assert "Test prompt" in system_prompt
            assert "debug_info" in system_prompt

    def test_get_model_config(self) -> None:
        """Test GenericAgent.get_model_config() method."""
        with patch(
            "app.v5.infra.agents.generic_agent.decrypt_api_key",
            return_value="decrypted_key",
        ):
            from app.v5.infra.agents.generic_agent import GenericAgent

            agent = GenericAgent(
                agent_name="test_agent",
                system_prompt="Test prompt",
                temperature=0.7,
                model_name="gpt-4",
                provider="openai",
                api_key="test_key",
                base_url="https://api.example.com",
                reasoning=None,
            )

            config = agent.get_model_config()

            assert "gpt-4" in config["model"]
            assert config["temperature"] == 0.7
            assert config["base_url"] == "https://api.example.com"
            assert "api_key" in config

    def test_get_tool_functions(self) -> None:
        """Test GenericAgent.get_tool_functions() method."""

        async def mock_tool(arg1: str) -> str:
            return "success"

        mock_tool.__name__ = "mock_tool"

        with patch(
            "app.v5.infra.agents.generic_agent.decrypt_api_key",
            return_value="decrypted_key",
        ):
            from app.v5.infra.agents.generic_agent import GenericAgent

            agent = GenericAgent(
                agent_name="test_agent",
                system_prompt="Test prompt",
                temperature=0.7,
                model_name="gpt-4",
                provider="openai",
                api_key="test_key",
                base_url=None,
                reasoning=None,
                tools=[mock_tool],
            )

            tool_functions = agent.get_tool_functions()

            assert "mock_tool" in tool_functions
            assert tool_functions["mock_tool"] == mock_tool

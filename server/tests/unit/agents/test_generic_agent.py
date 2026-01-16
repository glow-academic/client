"""Unit tests for app.infra.v4.agents.generic_agent."""

from unittest.mock import MagicMock

from app.infra.v4.agents.generic_agent import GenericAgent


class TestGenericAgent:
    """Tests for GenericAgent class."""

    def test_generic_agent_initialization(self) -> None:
        """Test GenericAgent initialization."""
        # Arrange & Act
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

        # Assert
        assert agent.agent_name == "test_agent"
        assert agent.system_prompt == "Test prompt"
        assert agent.temperature == 0.7
        assert agent.model_name == "gpt-4"
        assert agent.provider == "openai"

    def test_generic_agent_with_tools(self) -> None:
        """Test GenericAgent initialization with tools."""
        # Arrange
        mock_tool = MagicMock()

        # Act
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

        # Assert
        assert agent.tools is not None
        assert len(agent.tools) == 1

    def test_generic_agent_with_reasoning(self) -> None:
        """Test GenericAgent initialization with reasoning."""
        # Arrange & Act
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

        # Assert
        assert agent.reasoning == "high"

    def test_get_system_prompt(self) -> None:
        """Test GenericAgent.get_system_prompt() method."""
        # Arrange
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

        # Act
        system_prompt = agent.get_system_prompt()

        # Assert
        assert "Test prompt" in system_prompt
        assert "debug_info" in system_prompt  # Should include DEBUG_INFO_TOOL_SUFFIX

    def test_get_model_config(self) -> None:
        """Test GenericAgent.get_model_config() method."""
        # Arrange
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

        # Act
        config = agent.get_model_config()

        # Assert
        assert config["model"] == "gpt-4"
        assert config["temperature"] == 0.7
        assert config["base_url"] == "https://api.example.com"
        assert "api_key" in config

    def test_get_tool_functions(self) -> None:
        """Test GenericAgent.get_tool_functions() method."""
        # Arrange
        async def mock_tool(arg1: str) -> str:
            return "success"

        mock_tool.__name__ = "mock_tool"

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

        # Act
        tool_functions = agent.get_tool_functions()

        # Assert
        assert "mock_tool" in tool_functions
        assert tool_functions["mock_tool"] == mock_tool

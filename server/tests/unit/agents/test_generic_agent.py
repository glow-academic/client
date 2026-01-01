"""Unit tests for app.infra.v4.agents.generic_agent."""

from unittest.mock import MagicMock, patch

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

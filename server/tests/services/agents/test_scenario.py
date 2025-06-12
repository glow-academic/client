"""
Tests for app.services.agents.scenario

Auto-generated on: 2025-06-10T22:03:29.229537
"""

import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import Session
from uuid import uuid4

# Import the module being tested
from app.services.agents.scenario import run_scenario_agent, ScenarioAgent, Scenario


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


@pytest.fixture
def sample_agent():
    """Create a sample agent."""
    agent = MagicMock()
    agent.id = str(uuid4())
    agent.name = "Test Agent"
    agent.system_prompt = "Test prompt"
    agent.agent_type = "gta"
    agent.temperature = 7
    return agent


@pytest.fixture
def sample_class():
    """Create a sample class."""
    cls = MagicMock()
    cls.id = str(uuid4())
    cls.name = "Computer Science 101"
    cls.class_code = "CS101"
    cls.term = "Fall"
    cls.year = 2024
    return cls


class TestRun_Scenario_Agent:
    """Tests for run_scenario_agent function."""

    @patch("app.services.agents.scenario.Runner")
    @patch("app.services.agents.scenario.get_agent_info")
    @patch("app.services.agents.scenario.get_class_info")
    @patch("app.services.agents.scenario.get_document_info")
    @patch("app.services.agents.scenario.get_seniority_info")
    @patch("app.services.agents.scenario.get_crowdedness_info")
    @patch("app.services.agents.scenario.get_intensity_info")
    async def test_run_scenario_agent_success(
        self,
        mock_intensity,
        mock_crowdedness,
        mock_seniority,
        mock_document,
        mock_class_info,
        mock_agent_info,
        mock_runner,
        mock_session,
        sample_agent,
        sample_class,
    ):
        """Test successful run_scenario_agent execution."""
        # Setup mocks
        mock_session.exec.return_value.one_or_none.side_effect = [
            sample_agent,
            sample_class,
        ]

        mock_agent_info.return_value = {"role": "assistant", "content": "Agent info"}
        mock_class_info.return_value = {"role": "assistant", "content": "Class info"}
        mock_document.return_value = {"role": "assistant", "content": "Document info"}
        mock_seniority.return_value = {"role": "assistant", "content": "Seniority info"}
        mock_crowdedness.return_value = {
            "role": "assistant",
            "content": "Crowdedness info",
        }
        mock_intensity.return_value = {"role": "assistant", "content": "Intensity info"}

        # Mock the runner result
        mock_result = MagicMock()
        mock_scenario = Scenario(title="Test Title", scenario="Test Scenario")
        mock_result.final_output_as.return_value = mock_scenario
        mock_runner.run.return_value = mock_result

        # Test the function
        title, description = await run_scenario_agent(
            agent_id=sample_agent.id,
            class_id=sample_class.id,
            document_ids=["doc1", "doc2"],
            seniority="sophomore",
            crowdedness=5,
            intensity=3,
            session=mock_session,
        )

        assert title == "Test Title"
        assert description == "Test Scenario"

        # Verify all utility functions were called
        mock_agent_info.assert_called_once()
        mock_class_info.assert_called_once()
        mock_document.assert_called_once()
        mock_seniority.assert_called_once_with("sophomore")
        mock_crowdedness.assert_called_once_with(5)
        mock_intensity.assert_called_once_with(3)

    async def test_run_scenario_agent_agent_not_found(self, mock_session):
        """Test run_scenario_agent when agent is not found."""
        mock_session.exec.return_value.one_or_none.return_value = None

        with pytest.raises(ValueError, match="Agent with ID .* not found"):
            await run_scenario_agent(
                agent_id="nonexistent-id", class_id="class-id", session=mock_session
            )

    async def test_run_scenario_agent_class_not_found(self, mock_session, sample_agent):
        """Test run_scenario_agent when class is not found."""
        mock_session.exec.return_value.one_or_none.side_effect = [sample_agent, None]

        with pytest.raises(ValueError, match="Class with ID .* not found"):
            await run_scenario_agent(
                agent_id=sample_agent.id,
                class_id="nonexistent-class-id",
                session=mock_session,
            )


class TestScenarioAgent:
    """Tests for ScenarioAgent class."""

    @patch("app.services.agents.scenario.get_gemini")
    def test_scenario_agent_initialization(self, mock_get_gemini):
        """Test ScenarioAgent initialization."""
        mock_client = MagicMock()
        mock_get_gemini.return_value = mock_client

        agent = ScenarioAgent()

        assert agent.gemini_client == mock_client
        assert "scenario" in agent.system_prompt.lower()
        assert "gta" in agent.system_prompt.lower()

    @patch("app.services.agents.scenario.get_gemini")
    def test_scenario_agent_agent_method(self, mock_get_gemini):
        """Test ScenarioAgent agent method returns proper Agent."""
        mock_client = MagicMock()
        mock_get_gemini.return_value = mock_client

        scenario_agent = ScenarioAgent()
        agent = scenario_agent.agent()

        # Verify the agent is properly configured
        assert agent.name == "Scenario Agent"
        assert agent.output_type == Scenario


class TestScenario:
    """Tests for Scenario model."""

    def test_scenario_model_creation(self):
        """Test Scenario model creation."""
        scenario = Scenario(title="Test Title", scenario="Test Description")

        assert scenario.title == "Test Title"
        assert scenario.scenario == "Test Description"

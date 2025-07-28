"""
Tests for app.services.agents.collection.scenario
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from app.services.agents.collection.scenario import run_scenario_agent
from sqlmodel import Session


class MockPersona:
    def __init__(
        self,
        id,
        name,
        system_prompt,
        temperature,
        model_id,
        reasoning,
        description="Test persona",
    ):
        self.id = id
        self.name = name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model_id = model_id
        self.reasoning = reasoning
        self.description = description


class MockAgent:
    def __init__(self, id, name, system_prompt, temperature, model_id, reasoning):
        self.id = id
        self.name = name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model_id = model_id
        self.reasoning = reasoning


class MockModel:
    def __init__(self, id, name, provider_id):
        self.id = id
        self.name = name
        self.provider_id = provider_id


class MockProvider:
    def __init__(self, id, name, api_key):
        self.id = id
        self.name = name
        self.api_key = api_key


class MockScenario:
    def __init__(self, title, scenario):
        self.title = title
        self.scenario = scenario


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestRun_Scenario_Agent:
    """Tests for run_scenario_agent function."""

    @pytest.mark.asyncio
    async def test_run_scenario_agent_success(self, mock_session):
        """Test successful run_scenario_agent execution."""
        persona_id = uuid.uuid4()
        document_ids = [uuid.uuid4(), uuid.uuid4()]
        parameter_item_ids = [uuid.uuid4()]
        group_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()

        mock_persona = MockPersona(
            persona_id, "Test Persona", "You are helpful", 0.7, model_id, "medium"
        )
        mock_agent = MockAgent(
            agent_id, "Scenario", "Create scenarios", 0.7, model_id, "medium"
        )
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(
            provider_id, "openai", "dGVzdF9hcGlfa2V5"
        )  # base64 encoded "test_api_key"

        # Mock the database queries
        mock_session.exec.return_value.one_or_none.return_value = mock_persona
        mock_session.exec.return_value.one.side_effect = [
            mock_agent,
            mock_model,
            mock_provider,
        ]

        # Mock the Runner.run
        mock_result = MagicMock()
        mock_result.final_output_as.return_value = MockScenario(
            "Test Scenario", "A test scenario description"
        )

        with patch(
            "app.services.agents.collection.scenario.Runner.run",
            return_value=mock_result,
        ):
            with patch(
                "app.services.agents.generic.decrypt_api_key",
                return_value="decrypted_key",
            ):
                with patch(
                    "app.services.agents.collection.scenario.trace"
                ) as mock_trace:
                    # Mock the trace context manager
                    mock_trace.return_value.__enter__ = MagicMock()
                    mock_trace.return_value.__exit__ = MagicMock()
                    title, description, trace_id = await run_scenario_agent(
                        persona_id,
                        document_ids,
                        parameter_item_ids,
                        group_id,
                        mock_session,
                    )

                    assert title == "Test Scenario"
                    assert description == "A test scenario description"
                    assert isinstance(trace_id, str)

    @pytest.mark.asyncio
    async def test_run_scenario_agent_error(self, mock_session):
        """Test run_scenario_agent error handling."""
        persona_id = uuid.uuid4()

        # Mock the database query to raise an error
        mock_session.exec.return_value.one_or_none.side_effect = Exception(
            "Database error"
        )

        with pytest.raises(Exception, match="Database error"):
            await run_scenario_agent(persona_id, [], [], None, mock_session)

    @pytest.mark.asyncio
    async def test_run_scenario_agent_no_persona(self, mock_session):
        """Test run_scenario_agent with no persona."""
        agent_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()

        mock_agent = MockAgent(
            agent_id, "Scenario", "Create scenarios", 0.7, model_id, "medium"
        )
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(
            provider_id, "openai", "dGVzdF9hcGlfa2V5"
        )  # base64 encoded "test_api_key"

        # Mock the database queries
        mock_session.exec.return_value.one_or_none.return_value = None  # No persona
        mock_session.exec.return_value.one.side_effect = [
            mock_agent,
            mock_model,
            mock_provider,
        ]

        # Mock the Runner.run
        mock_result = MagicMock()
        mock_result.final_output_as.return_value = MockScenario(
            "Test Scenario", "A test scenario description"
        )

        with patch(
            "app.services.agents.collection.scenario.Runner.run",
            return_value=mock_result,
        ):
            with patch(
                "app.services.agents.generic.decrypt_api_key",
                return_value="decrypted_key",
            ):
                title, description, trace_id = await run_scenario_agent(
                    None, [], [], None, mock_session
                )

                assert title == "Test Scenario"
                assert description == "A test scenario description"
                assert isinstance(trace_id, str)

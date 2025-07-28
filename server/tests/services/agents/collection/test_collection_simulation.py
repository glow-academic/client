"""
Tests for app.services.agents.collection.simulation
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from agents import Runner
from app.services.agents.collection.simulation import (cancel_simulation_run,
                                                       run_simulation_agent)
from sqlmodel import Session


class MockSimulationChat:
    def __init__(self, id, attempt_id, title, trace_id=None):
        self.id = id
        self.attempt_id = attempt_id
        self.title = title
        self.trace_id = trace_id or str(uuid.uuid4())


class MockSimulationAttempt:
    def __init__(self, id, simulation_id):
        self.id = id
        self.simulation_id = simulation_id


class MockSimulation:
    def __init__(self, id, title, rubric_id):
        self.id = id
        self.title = title
        self.rubric_id = rubric_id


class MockScenario:
    def __init__(self, id, name, description, persona_id):
        self.id = id
        self.name = name
        self.description = description
        self.persona_id = persona_id


class MockPersona:
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


class MockSimulationMessage:
    def __init__(self, id, chat_id, content, type="query", created_at=None):
        self.id = id
        self.chat_id = chat_id
        self.content = content
        self.type = type
        self.created_at = created_at or datetime.now()


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestRun_Simulation_Agent:
    """Tests for run_simulation_agent function."""

    @pytest.mark.asyncio
    async def test_run_simulation_agent_success(self, mock_session):
        """Test successful run_simulation_agent execution."""
        chat_id = uuid.uuid4()
        attempt_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        persona_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()
        
        mock_chat = MockSimulationChat(chat_id, attempt_id, "Test Chat")
        mock_attempt = MockSimulationAttempt(attempt_id, simulation_id)
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", uuid.uuid4())
        mock_scenario = MockScenario(scenario_id, "Test Scenario", "A test scenario", persona_id)
        mock_persona = MockPersona(persona_id, "Test Persona", "You are helpful", 0.7, model_id, "medium")
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(provider_id, "openai", "encrypted_api_key")
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hello", "query"),
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hi there", "response")
        ]
        
        # Mock the database queries
        mock_session.exec.return_value.one_or_none.return_value = mock_chat
        mock_session.exec.return_value.one.side_effect = [mock_attempt, mock_simulation, mock_scenario, mock_persona, mock_model, mock_provider]
        mock_session.exec.return_value.all.return_value = mock_messages
        
        # Mock the Runner.run_streamed
        mock_result = AsyncMock()
        mock_result.stream_events.return_value = [
            MagicMock(type="raw_response_event", data=MagicMock(delta="Hello"))
        ]
        
        with patch('app.services.agents.collection.simulation.Runner.run_streamed', return_value=mock_result):
            async for chunk in run_simulation_agent(chat_id, mock_session):
                assert chunk == "Hello"
                break  # Just test the first chunk

    @pytest.mark.asyncio
    async def test_run_simulation_agent_error(self, mock_session):
        """Test run_simulation_agent error handling."""
        chat_id = uuid.uuid4()
        
        # Mock the database query to return None (chat not found)
        mock_session.exec.return_value.one_or_none.return_value = None
        
        with pytest.raises(ValueError, match=f"Chat not found with ID: {chat_id}"):
            async for chunk in run_simulation_agent(chat_id, mock_session):
                pass


class TestCancel_Simulation_Run:
    """Tests for cancel_simulation_run function."""

    def test_cancel_simulation_run_success(self, mock_session):
        """Test successful cancel_simulation_run execution."""
        chat_id = uuid.uuid4()
        
        # Mock the active run
        mock_run = MagicMock()
        mock_run.cancel.return_value = True
        
        with patch('app.services.agents.collection.simulation.cancel_active_run', return_value=True):
            result = cancel_simulation_run(chat_id)
            
            assert result is True

    def test_cancel_simulation_run_error(self, mock_session):
        """Test cancel_simulation_run error handling."""
        chat_id = uuid.uuid4()
        
        # Mock no active run found
        with patch('app.services.agents.collection.simulation.cancel_active_run', return_value=False):
            result = cancel_simulation_run(chat_id)
            
            assert result is False

    def test_cancel_simulation_run_invalid_uuid(self, mock_session):
        """Test cancel_simulation_run with invalid UUID."""
        with pytest.raises(ValueError):
            cancel_simulation_run("invalid-uuid")

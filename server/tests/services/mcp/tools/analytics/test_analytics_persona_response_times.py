"""
Tests for app.services.mcp.tools.analytics.persona_response_times
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.analytics.persona_response_times import \
    persona_response_times
from sqlalchemy.exc import SQLAlchemyError


class MockPersona:
    def __init__(self, id, name, description="Test description"):
        self.id = id
        self.name = name
        self.description = description


class MockScenario:
    def __init__(self, id, name, persona_id):
        self.id = id
        self.name = name
        self.persona_id = persona_id


class MockSimulationChat:
    def __init__(self, id, scenario_id, created_at=None):
        self.id = id
        self.scenario_id = scenario_id
        self.created_at = created_at or datetime.now()


class MockSimulationMessage:
    def __init__(self, id, chat_id, content, type="response", created_at=None):
        self.id = id
        self.chat_id = chat_id
        self.content = content
        self.type = type
        self.created_at = created_at or datetime.now()


@patch("app.services.mcp.tools.analytics.persona_response_times.get_session")
class TestPersona_Response_Times:
    """Tests for persona_response_times function."""

    def test_persona_response_times_success(self, mock_get_session):
        """Test successful persona_response_times execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_persona = MockPersona(persona_id, "Aggressive Manager")
        mock_scenario = MockScenario(scenario_id, "Test Scenario", persona_id)
        mock_chat = MockSimulationChat(chat_id, scenario_id)
        
        # Mock messages with response times
        base_time = datetime.now()
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hello", "query", base_time),
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hi there", "response", base_time + timedelta(seconds=5)),
            MockSimulationMessage(uuid.uuid4(), chat_id, "How are you?", "query", base_time + timedelta(seconds=10)),
            MockSimulationMessage(uuid.uuid4(), chat_id, "I'm good", "response", base_time + timedelta(seconds=18)),
        ]
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.side_effect = [[mock_scenario], [mock_chat], mock_messages]
        
        result = persona_response_times(str(persona_id))
        
        assert result["persona"]["id"] == str(persona_id)
        assert result["persona"]["name"] == "Aggressive Manager"
        assert "stats" in result
        assert "recent_responses" in result
        assert len(result["recent_responses"]) == 2
        # Responses are sorted by response time (slowest first)
        assert result["recent_responses"][0]["response_time_seconds"] == 8  # 18-10
        assert result["recent_responses"][1]["response_time_seconds"] == 5  # 5-0

    def test_persona_response_times_error(self, mock_get_session):
        """Test persona_response_times error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")
        
        result = persona_response_times(str(persona_id))
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_persona_response_times_persona_not_found(self, mock_get_session):
        """Test persona_response_times with non-existent persona."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_session.get.return_value = None
        
        result = persona_response_times(str(persona_id))
        
        assert "error" in result
        assert "Persona not found" in result["error"]

    def test_persona_response_times_invalid_uuid(self, mock_get_session):
        """Test persona_response_times with invalid UUID."""
        result = persona_response_times("invalid-uuid")
        
        assert "error" in result
        assert "Invalid persona_id format" in result["error"]

    def test_persona_response_times_no_scenarios(self, mock_get_session):
        """Test persona_response_times with no scenarios."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Test Persona")
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = []
        
        result = persona_response_times(str(persona_id))
        
        assert result["persona"]["id"] == str(persona_id)
        assert result["recent_responses"] == []
        assert "No scenarios found" in result["stats"]["message"]

    def test_persona_response_times_no_messages(self, mock_get_session):
        """Test persona_response_times with no messages."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_persona = MockPersona(persona_id, "Test Persona")
        mock_scenario = MockScenario(scenario_id, "Test Scenario", persona_id)
        mock_chat = MockSimulationChat(chat_id, scenario_id)
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.side_effect = [[mock_scenario], [mock_chat], []]
        
        result = persona_response_times(str(persona_id))
        
        assert result["persona"]["id"] == str(persona_id)
        assert result["recent_responses"] == []
        assert "No response data found" in result["stats"]["message"]

    def test_persona_response_times_single_response(self, mock_get_session):
        """Test persona_response_times with single query-response pair."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_persona = MockPersona(persona_id, "Test Persona")
        mock_scenario = MockScenario(scenario_id, "Test Scenario", persona_id)
        mock_chat = MockSimulationChat(chat_id, scenario_id)
        
        base_time = datetime.now()
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hello", "query", base_time),
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hi there", "response", base_time + timedelta(seconds=12)),
        ]
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.side_effect = [[mock_scenario], [mock_chat], mock_messages]
        
        result = persona_response_times(str(persona_id))
        
        assert len(result["recent_responses"]) == 1
        assert result["recent_responses"][0]["response_time_seconds"] == 12
        assert result["stats"]["avg_response_time"] == 12.0

    def test_persona_response_times_multiple_responses(self, mock_get_session):
        """Test persona_response_times with multiple response times."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_persona = MockPersona(persona_id, "Test Persona")
        mock_scenario = MockScenario(scenario_id, "Test Scenario", persona_id)
        mock_chat = MockSimulationChat(chat_id, scenario_id)
        
        base_time = datetime.now()
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hello", "query", base_time),
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hi", "response", base_time + timedelta(seconds=5)),
            MockSimulationMessage(uuid.uuid4(), chat_id, "How are you?", "query", base_time + timedelta(seconds=10)),
            MockSimulationMessage(uuid.uuid4(), chat_id, "Good", "response", base_time + timedelta(seconds=15)),
            MockSimulationMessage(uuid.uuid4(), chat_id, "What's up?", "query", base_time + timedelta(seconds=20)),
            MockSimulationMessage(uuid.uuid4(), chat_id, "Not much", "response", base_time + timedelta(seconds=30)),
        ]
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.side_effect = [[mock_scenario], [mock_chat], mock_messages]
        
        result = persona_response_times(str(persona_id))
        
        assert len(result["recent_responses"]) == 3
        # Responses are sorted by response time (slowest first)
        assert result["recent_responses"][0]["response_time_seconds"] == 10  # 30-20
        assert result["recent_responses"][1]["response_time_seconds"] == 5   # 15-10
        assert result["recent_responses"][2]["response_time_seconds"] == 5   # 5-0
        assert result["stats"]["avg_response_time"] == 6.67  # (5+5+10)/3

    def test_persona_response_times_unmatched_queries(self, mock_get_session):
        """Test persona_response_times with unmatched queries."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_persona = MockPersona(persona_id, "Test Persona")
        mock_scenario = MockScenario(scenario_id, "Test Scenario", persona_id)
        mock_chat = MockSimulationChat(chat_id, scenario_id)
        
        base_time = datetime.now()
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hello", "query", base_time),
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hi there", "response", base_time + timedelta(seconds=5)),
            MockSimulationMessage(uuid.uuid4(), chat_id, "How are you?", "query", base_time + timedelta(seconds=10)),
            # Missing response for second query
        ]
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.side_effect = [[mock_scenario], [mock_chat], mock_messages]
        
        result = persona_response_times(str(persona_id))
        
        assert len(result["recent_responses"]) == 1
        assert result["recent_responses"][0]["response_time_seconds"] == 5


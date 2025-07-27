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
    def __init__(self, id, name):
        self.id = id
        self.name = name


class MockSimulationMessage:
    def __init__(self, id, created_at, type="response"):
        self.id = id
        self.created_at = created_at
        self.type = type


@patch("app.services.mcp.tools.analytics.persona_response_times.get_session")
class TestPersona_Response_Times:
    """Tests for persona_response_times function."""

    def test_persona_response_times_success(self, mock_get_session):
        """Test successful persona_response_times execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Aggressive Manager")
        
        # Mock messages with response times
        base_time = datetime.now()
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), base_time, "query"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=5), "response"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=10), "query"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=18), "response"),
        ]
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = mock_messages
        
        result = persona_response_times(str(persona_id))
        
        assert result["persona"]["id"] == str(persona_id)
        assert result["persona"]["name"] == "Aggressive Manager"
        assert "response_times" in result
        assert len(result["response_times"]) == 2
        assert result["response_times"][0]["response_time_seconds"] == 5
        assert result["response_times"][1]["response_time_seconds"] == 8

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

    def test_persona_response_times_no_messages(self, mock_get_session):
        """Test persona_response_times with no messages."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Test Persona")
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = []
        
        result = persona_response_times(str(persona_id))
        
        assert result["persona"]["id"] == str(persona_id)
        assert result["response_times"] == []
        assert result["average_response_time"] == 0

    def test_persona_response_times_single_response(self, mock_get_session):
        """Test persona_response_times with single query-response pair."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Test Persona")
        
        base_time = datetime.now()
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), base_time, "query"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=12), "response"),
        ]
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = mock_messages
        
        result = persona_response_times(str(persona_id))
        
        assert len(result["response_times"]) == 1
        assert result["response_times"][0]["response_time_seconds"] == 12
        assert result["average_response_time"] == 12

    def test_persona_response_times_multiple_responses(self, mock_get_session):
        """Test persona_response_times with multiple response times."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Test Persona")
        
        base_time = datetime.now()
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), base_time, "query"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=5), "response"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=10), "query"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=15), "response"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=20), "query"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=30), "response"),
        ]
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = mock_messages
        
        result = persona_response_times(str(persona_id))
        
        assert len(result["response_times"]) == 3
        assert result["response_times"][0]["response_time_seconds"] == 5
        assert result["response_times"][1]["response_time_seconds"] == 5
        assert result["response_times"][2]["response_time_seconds"] == 10
        assert result["average_response_time"] == 6.67  # (5+5+10)/3

    def test_persona_response_times_unmatched_queries(self, mock_get_session):
        """Test persona_response_times with unmatched queries."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Test Persona")
        
        base_time = datetime.now()
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), base_time, "query"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=5), "response"),
            MockSimulationMessage(uuid.uuid4(), base_time + timedelta(seconds=10), "query"),
            # Missing response for second query
        ]
        
        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = mock_messages
        
        result = persona_response_times(str(persona_id))
        
        assert len(result["response_times"]) == 1
        assert result["response_times"][0]["response_time_seconds"] == 5


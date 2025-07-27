"""
Tests for app.services.mcp.tools.lookup.profile_overview
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.lookup.profile_overview import profile_overview
from sqlalchemy.exc import SQLAlchemyError


class MockProfile:
    def __init__(self, id, first_name, last_name, alias, role="student"):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.alias = alias
        self.role = role
        self.last_login = datetime.now()
        self.created_at = datetime.now()
        self.viewed_intro = False
        self.active = True


class MockSimulationAttempt:
    def __init__(self, id, created_at, simulation_id):
        self.id = id
        self.created_at = created_at
        self.simulation_id = simulation_id


class MockSimulationChat:
    def __init__(self, id, attempt_id, created_at):
        self.id = id
        self.attempt_id = attempt_id
        self.created_at = created_at


class MockSimulationChatGrade:
    def __init__(self, chat_id, score, passed, time_taken):
        self.simulation_chat_id = chat_id
        self.score = score
        self.passed = passed
        self.time_taken = time_taken
        self.created_at = datetime.now()


@patch("app.services.mcp.tools.lookup.profile_overview.get_session")
class TestProfile_Overview:
    """Tests for profile_overview function."""

    def test_profile_overview_success(self, mock_get_session):
        """Test successful profile_overview execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = []
        mock_session.exec.return_value.first.return_value = None
        
        result = profile_overview(str(profile_id))
        
        assert result["profile"]["id"] == str(profile_id)
        assert result["profile"]["alias"] == "jdoe"
        assert result["profile"]["first_name"] == "John"
        assert result["profile"]["last_name"] == "Doe"
        assert result["profile"]["role"] == "student"
        assert result["latest_grades"] == []

    def test_profile_overview_error(self, mock_get_session):
        """Test profile_overview error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")
        
        result = profile_overview(str(profile_id))
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_profile_overview_profile_not_found(self, mock_get_session):
        """Test profile_overview with non-existent profile."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_session.get.return_value = None
        
        result = profile_overview(str(profile_id))
        
        assert "error" in result
        assert "Profile not found" in result["error"]

    def test_profile_overview_invalid_uuid(self, mock_get_session):
        """Test profile_overview with invalid UUID."""
        result = profile_overview("invalid-uuid")
        
        assert "error" in result
        assert "Invalid profile_id format" in result["error"]

    def test_profile_overview_with_grades(self, mock_get_session):
        """Test profile_overview with grade information."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        
        base_time = datetime.now()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_attempt = MockSimulationAttempt(attempt_id, base_time, uuid.uuid4())
        mock_chat = MockSimulationChat(chat_id, attempt_id, base_time)
        mock_grade = MockSimulationChatGrade(chat_id, 85, True, 300)
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = [mock_attempt]
        mock_session.exec.return_value.first.return_value = mock_chat
        mock_session.exec.return_value.first.return_value = mock_grade
        
        result = profile_overview(str(profile_id))
        
        assert len(result["latest_grades"]) == 1
        grade = result["latest_grades"][0]
        assert grade["score"] == 85
        assert grade["passed"] is True
        assert grade["time_taken"] == 300

    def test_profile_overview_multiple_attempts(self, mock_get_session):
        """Test profile_overview with multiple attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        
        base_time = datetime.now()
        attempt1_id = uuid.uuid4()
        attempt2_id = uuid.uuid4()
        
        mock_attempt1 = MockSimulationAttempt(attempt1_id, base_time, uuid.uuid4())
        mock_attempt2 = MockSimulationAttempt(attempt2_id, base_time + timedelta(hours=1), uuid.uuid4())
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = [mock_attempt1, mock_attempt2]
        mock_session.exec.return_value.first.return_value = None
        
        result = profile_overview(str(profile_id))
        
        assert len(result["latest_grades"]) == 2

    def test_profile_overview_null_timestamps(self, mock_get_session):
        """Test profile_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_profile.last_login = None
        mock_profile.created_at = None
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = []
        
        result = profile_overview(str(profile_id))
        
        assert result["profile"]["last_login"] is None
        assert result["profile"]["created_at"] is None

    def test_profile_overview_case_insensitive_search(self, mock_get_session):
        """Test profile_overview case insensitive search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = []
        
        # Test with lowercase alias
        result = profile_overview("jdoe")
        
        assert result["profile"]["alias"] == "jdoe"
        assert result["profile"]["first_name"] == "John"

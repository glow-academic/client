"""
Tests for app.mcp.tools.lookup.profile_overview
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from app.mcp.tools.lookup.profile_overview import profile_overview
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


class MockSimulation:
    def __init__(self, id, title):
        self.id = id
        self.title = title


class MockSimulationAttempt:
    def __init__(self, id, created_at, simulation_id, profile_id=None):
        self.id = id
        self.created_at = created_at
        self.simulation_id = simulation_id
        self.profile_id = profile_id or uuid.uuid4()


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


@patch("app.mcp.tools.lookup.profile_overview.get_session")
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
        mock_session.exec.return_value.first.return_value = None

        result = profile_overview(str(profile_id))

        assert "error" in result
        assert "Profile not found" in result["error"]

    def test_profile_overview_invalid_uuid(self, mock_get_session):
        """Test profile_overview with invalid UUID."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_session.exec.return_value.first.return_value = None

        result = profile_overview("invalid-uuid")

        assert "error" in result
        assert "Profile not found" in result["error"]

    def test_profile_overview_with_grades(self, mock_get_session):
        """Test profile_overview with grades."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()

        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        mock_attempt = MockSimulationAttempt(
            attempt_id, datetime.now(), simulation_id, profile_id
        )
        mock_chat = MockSimulationChat(chat_id, attempt_id, datetime.now())
        mock_grade = MockSimulationChatGrade(chat_id, 85, True, 300)

        mock_session.get.side_effect = lambda model, id: {
            profile_id: mock_profile,
            simulation_id: mock_simulation,
        }.get(id)
        mock_session.exec.return_value.all.side_effect = [[mock_attempt], [mock_chat]]
        mock_session.exec.return_value.first.return_value = mock_grade

        result = profile_overview(str(profile_id))

        assert result["profile"]["id"] == str(profile_id)
        assert len(result["latest_grades"]) == 1
        assert result["latest_grades"][0]["simulation_title"] == "Test Simulation"
        assert result["latest_grades"][0]["score"] == 85
        assert result["latest_grades"][0]["passed"] is True

    def test_profile_overview_multiple_attempts(self, mock_get_session):
        """Test profile_overview with multiple attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()

        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")

        # Create multiple attempts
        base_time = datetime.now()
        attempt1 = MockSimulationAttempt(
            uuid.uuid4(), base_time, simulation_id, profile_id
        )
        attempt2 = MockSimulationAttempt(
            uuid.uuid4(), base_time + timedelta(hours=1), simulation_id, profile_id
        )

        mock_session.get.side_effect = lambda model, id: {
            profile_id: mock_profile,
            simulation_id: mock_simulation,
        }.get(id)
        mock_session.exec.return_value.all.side_effect = [[attempt1, attempt2], [], []]
        mock_session.exec.return_value.first.return_value = None

        result = profile_overview(str(profile_id))

        assert result["profile"]["id"] == str(profile_id)
        assert result["latest_grades"] == []

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

        assert result["profile"]["id"] == str(profile_id)
        assert result["profile"]["last_login"] is None
        assert result["profile"]["created_at"] is None

    def test_profile_overview_case_insensitive_search(self, mock_get_session):
        """Test profile_overview with case insensitive search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        profile_id = uuid.uuid4()
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")

        # Mock the search by name functionality
        mock_session.get.side_effect = ValueError("Invalid UUID")
        mock_session.exec.return_value.first.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = []

        result = profile_overview("john")

        assert result["profile"]["id"] == str(profile_id)
        assert result["profile"]["first_name"] == "John"
        assert result["profile"]["last_name"] == "Doe"

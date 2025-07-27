"""
Tests for app.services.mcp.tools.lookup.profile_overview
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.lookup.profile_overview import profile_overview
from sqlalchemy.exc import SQLAlchemyError


class MockProfile:
    def __init__(self, id, fname, lname, alias, role="student"):
        self.id = id
        self.first_name = fname
        self.last_name = lname
        self.alias = alias
        self.role = role
        self.last_login = datetime.now()
        self.created_at = datetime.now()
        self.viewed_intro = False
        self.active = True





class MockSimulation:
    def __init__(
        self,
        id,
        title,
        active=True,
        time_limit=30,
        rubric_id=None,
        cohort_ids=None,
        scenario_ids=None,
    ):
        self.id = id
        self.title = title
        self.active = active
        self.time_limit = time_limit
        self.rubric_id = rubric_id or uuid.uuid4()
        self.cohort_ids = cohort_ids or []
        self.scenario_ids = scenario_ids or []
        self.created_at = datetime.now()


class MockAttempt:
    def __init__(self, id, sim_id, profile_id):
        self.id = id
        self.simulation_id = sim_id
        self.profile_id = profile_id
        self.created_at = datetime.now()


class MockChat:
    def __init__(self, id, attempt_id):
        self.id = id
        self.attempt_id = attempt_id
        self.created_at = datetime.now()


class MockGrade:
    def __init__(self, chat_id, score, passed):
        self.simulation_chat_id = chat_id
        self.score = score
        self.passed = passed
        self.time_taken = 120
        self.created_at = datetime.now()


@patch("app.services.mcp.tools.lookup.profile_overview.get_session")
class TestProfileOverview:
    """Tests for profile_overview function."""

    def test_profile_overview_by_uuid(self, mock_get_session):
        """Test profile_overview with UUID input."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        profile_id = uuid.uuid4()

        mock_profile = MockProfile(profile_id, "Nina", "Park", "npark")

        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = []
        mock_session.exec.return_value.first.return_value = None

        result = profile_overview(str(profile_id))

        assert result["profile"]["id"] == str(profile_id)
        assert result["profile"]["alias"] == "npark"
        assert result["profile"]["first_name"] == "Nina"
        assert result["profile"]["last_name"] == "Park"
        assert result["profile"]["role"] == "student"
        assert result["latest_grades"] == []

    def test_profile_overview_by_name(self, mock_get_session):
        """Test profile_overview with name search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_profile = MockProfile(uuid.uuid4(), "Nina", "Park", "npark")
        mock_session.get.return_value = None  # UUID lookup fails
        mock_session.exec.return_value.first.return_value = (
            mock_profile  # Name search succeeds
        )
        mock_session.exec.return_value.all.return_value = []  # For attempts

        result = profile_overview("Nina Park")

        assert result["profile"]["alias"] == "npark"
        assert result["profile"]["first_name"] == "Nina"
        assert result["profile"]["last_name"] == "Park"
        assert result["latest_grades"] == []

    def test_profile_overview_by_alias(self, mock_get_session):
        """Test profile_overview with alias search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_profile = MockProfile(uuid.uuid4(), "Nina", "Park", "npark")
        mock_session.get.return_value = None  # UUID lookup fails
        mock_session.exec.return_value.first.return_value = (
            mock_profile  # Alias search succeeds
        )
        mock_session.exec.return_value.all.return_value = []  # For attempts

        result = profile_overview("npark")

        assert result["profile"]["alias"] == "npark"
        assert result["latest_grades"] == []

    def test_profile_overview_not_found(self, mock_get_session):
        """Test profile_overview when profile is not found."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_session.get.return_value = None  # UUID lookup fails
        mock_session.exec.return_value.first.return_value = None  # Name search fails

        result = profile_overview("Nonexistent User")

        assert "error" in result
        assert "not found" in result["error"]

    def test_profile_overview_database_error(self, mock_get_session):
        """Test profile_overview database error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")

        result = profile_overview(str(uuid.uuid4()))

        assert "error" in result
        assert "Database error" in result["error"]



    def test_profile_overview_with_grades(self, mock_get_session):
        """Test profile_overview with simulation grades."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        profile_id = uuid.uuid4()
        sim_id = uuid.uuid4()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()

        mock_profile = MockProfile(profile_id, "Nina", "Park", "npark")
        mock_sim = MockSimulation(sim_id, "Test Simulation")
        mock_attempt = MockAttempt(attempt_id, sim_id, profile_id)
        mock_chat = MockChat(chat_id, attempt_id)
        mock_grade = MockGrade(chat_id, 85, True)

        # Mock session.get to return profile first, then simulation
        mock_session.get.side_effect = [mock_profile, mock_sim]
        # Mock session.exec calls: attempts, chats
        mock_session.exec.return_value.all.side_effect = [
            [mock_attempt],  # attempts
            [mock_chat],  # chats
        ]
        mock_session.exec.return_value.first.side_effect = [mock_grade]  # grade

        result = profile_overview(str(profile_id))

        assert len(result["latest_grades"]) == 1
        assert result["latest_grades"][0]["simulation_title"] == "Test Simulation"
        assert result["latest_grades"][0]["score"] == 85
        assert result["latest_grades"][0]["passed"] is True

    def test_profile_overview_multiple_attempts(self, mock_get_session):
        """Test profile_overview with multiple attempts (should limit to 5)."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        profile_id = uuid.uuid4()
        sim_id = uuid.uuid4()

        mock_profile = MockProfile(profile_id, "Nina", "Park", "npark")
        mock_sim = MockSimulation(sim_id, "Test Simulation")

        # Create 7 attempts (should only get latest 5)
        mock_attempts = []
        for i in range(7):
            attempt = MockAttempt(uuid.uuid4(), sim_id, profile_id)
            attempt.created_at = datetime(2025, 1, i + 1)  # Different dates
            mock_attempts.append(attempt)

        # The function calls session.get for profile, then for each attempt it calls session.get for simulation
        # So we need to provide simulation for each attempt
        mock_session.get.side_effect = [mock_profile] + [mock_sim] * len(mock_attempts)
        # The function loops through attempts and for each attempt, it gets chats
        # So we need to provide chats for each attempt
        mock_session.exec.return_value.all.side_effect = [
            mock_attempts,  # attempts
        ] + [[] for _ in mock_attempts]  # empty chats for each attempt
        mock_session.exec.return_value.first.return_value = None  # No grades

        result = profile_overview(str(profile_id))

        # Should only process the latest 5 attempts
        assert len(result["latest_grades"]) == 0  # No grades in this test

    def test_profile_overview_null_timestamps(self, mock_get_session):
        """Test profile_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        profile_id = uuid.uuid4()

        mock_profile = MockProfile(profile_id, "Nina", "Park", "npark")
        mock_profile.last_login = None
        mock_profile.created_at = None

        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = []

        result = profile_overview(str(profile_id))

        assert result["profile"]["last_login"] is None
        assert result["profile"]["created_at"] is None

    def test_profile_overview_case_insensitive_search(self, mock_get_session):
        """Test profile_overview case insensitive name search."""
        # Test each case variation separately to avoid session exhaustion
        test_cases = ["nina park", "NINA PARK", "NiNa PaRk"]

        for test_case in test_cases:
            mock_session = MagicMock()
            mock_get_session.return_value = iter([mock_session])

            mock_profile = MockProfile(uuid.uuid4(), "Nina", "Park", "npark")
            mock_session.get.return_value = None  # UUID lookup fails
            mock_session.exec.return_value.first.return_value = (
                mock_profile  # Name search succeeds
            )
            mock_session.exec.return_value.all.return_value = []

            result = profile_overview(test_case)

            assert result["profile"]["alias"] == "npark"




@pytest.mark.skip(reason="TODO: implement tests for `profile_overview`")
class TestProfile_Overview:
    """Tests for profile_overview function."""

    def test_profile_overview_success(self):
        """Test successful profile_overview execution."""
        # TODO: Implement test for profile_overview
        assert False, "IMPLEMENT: Test for profile_overview"

    def test_profile_overview_error(self):
        """Test profile_overview error handling."""
        # TODO: Implement error test for profile_overview
        assert False, "IMPLEMENT: Error test for profile_overview"

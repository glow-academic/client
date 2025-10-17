"""
Tests for app.mcp.tools.analytics.simulation_attempts
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from app.mcp.tools.analytics.simulation_attempts import simulation_attempts
from sqlalchemy.exc import SQLAlchemyError


class MockSimulation:
    def __init__(self, id, title, active=True):
        self.id = id
        self.title = title
        self.active = active


class MockSimulationAttempt:
    def __init__(self, id, created_at, profile_id=None, simulation_id=None):
        self.id = id
        self.created_at = created_at
        self.profile_id = profile_id or uuid.uuid4()
        self.simulation_id = simulation_id or uuid.uuid4()


class MockProfile:
    def __init__(self, id, first_name, last_name, alias="test_alias"):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.alias = alias


class MockSimulationChat:
    def __init__(self, id, attempt_id, created_at=None):
        self.id = id
        self.attempt_id = attempt_id
        self.created_at = created_at or datetime.now()


class MockSimulationChatGrade:
    def __init__(self, id, score, passed, time_taken=300):
        self.id = id
        self.score = score
        self.passed = passed
        self.time_taken = time_taken


@patch("app.mcp.tools.analytics.simulation_attempts.get_session")
class TestSimulation_Attempts:
    """Tests for simulation_attempts function."""

    def test_simulation_attempts_success(self, mock_get_session):
        """Test successful simulation_attempts execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Conflict Resolution")

        # Mock attempts
        base_time = datetime.now()
        profile1_id = uuid.uuid4()
        profile2_id = uuid.uuid4()

        mock_attempts = [
            MockSimulationAttempt(uuid.uuid4(), base_time, profile1_id, simulation_id),
            MockSimulationAttempt(
                uuid.uuid4(), base_time + timedelta(hours=1), profile2_id, simulation_id
            ),
            MockSimulationAttempt(
                uuid.uuid4(), base_time + timedelta(hours=2), profile1_id, simulation_id
            ),
        ]

        mock_profiles = [
            MockProfile(profile1_id, "John", "Doe"),
            MockProfile(profile2_id, "Jane", "Smith"),
        ]

        mock_session.get.side_effect = [
            mock_simulation,
            mock_profiles[0],
            mock_profiles[1],
            mock_profiles[0],
        ]
        mock_session.exec.return_value.all.side_effect = [mock_attempts, [], [], []]
        mock_session.exec.return_value.first.return_value = None

        result = simulation_attempts(str(simulation_id))

        assert len(result) == 3
        assert result[0]["student"] == "John Doe"
        assert result[1]["student"] == "Jane Smith"
        assert result[2]["student"] == "John Doe"

    def test_simulation_attempts_error(self, mock_get_session):
        """Test simulation_attempts error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")

        result = simulation_attempts(str(simulation_id))

        assert len(result) == 1
        assert "error" in result[0]
        assert "Database error" in result[0]["error"]

    def test_simulation_attempts_simulation_not_found(self, mock_get_session):
        """Test simulation_attempts with non-existent simulation."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        mock_session.get.return_value = None

        result = simulation_attempts(str(simulation_id))

        assert len(result) == 1
        assert "error" in result[0]
        assert "Simulation not found" in result[0]["error"]

    def test_simulation_attempts_invalid_uuid(self, mock_get_session):
        """Test simulation_attempts with invalid UUID."""
        result = simulation_attempts("invalid-uuid")

        assert len(result) == 1
        assert "error" in result[0]
        assert "Invalid sim_id format" in result[0]["error"]

    def test_simulation_attempts_no_attempts(self, mock_get_session):
        """Test simulation_attempts with no attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")

        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.all.return_value = []

        result = simulation_attempts(str(simulation_id))

        assert result == []

    def test_simulation_attempts_single_student(self, mock_get_session):
        """Test simulation_attempts with single student multiple attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")

        profile_id = uuid.uuid4()
        base_time = datetime.now()

        mock_attempts = [
            MockSimulationAttempt(uuid.uuid4(), base_time, profile_id, simulation_id),
            MockSimulationAttempt(
                uuid.uuid4(), base_time + timedelta(hours=1), profile_id, simulation_id
            ),
            MockSimulationAttempt(
                uuid.uuid4(), base_time + timedelta(hours=2), profile_id, simulation_id
            ),
        ]

        mock_profile = MockProfile(profile_id, "John", "Doe")

        mock_session.get.side_effect = [
            mock_simulation,
            mock_profile,
            mock_profile,
            mock_profile,
        ]
        mock_session.exec.return_value.all.side_effect = [mock_attempts, [], [], []]
        mock_session.exec.return_value.first.return_value = None

        result = simulation_attempts(str(simulation_id))

        assert len(result) == 3
        assert all(attempt["student"] == "John Doe" for attempt in result)

    def test_simulation_attempts_multiple_students(self, mock_get_session):
        """Test simulation_attempts with multiple students."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")

        profile1_id = uuid.uuid4()
        profile2_id = uuid.uuid4()
        profile3_id = uuid.uuid4()

        base_time = datetime.now()

        mock_attempts = [
            MockSimulationAttempt(uuid.uuid4(), base_time, profile1_id, simulation_id),
            MockSimulationAttempt(
                uuid.uuid4(), base_time + timedelta(hours=1), profile2_id, simulation_id
            ),
            MockSimulationAttempt(
                uuid.uuid4(), base_time + timedelta(hours=2), profile3_id, simulation_id
            ),
            MockSimulationAttempt(
                uuid.uuid4(), base_time + timedelta(hours=3), profile1_id, simulation_id
            ),
        ]

        mock_profiles = [
            MockProfile(profile1_id, "John", "Doe"),
            MockProfile(profile2_id, "Jane", "Smith"),
            MockProfile(profile3_id, "Bob", "Johnson"),
        ]

        mock_session.get.side_effect = [
            mock_simulation,
            mock_profiles[0],
            mock_profiles[1],
            mock_profiles[2],
            mock_profiles[0],
        ]
        mock_session.exec.return_value.all.side_effect = [mock_attempts, [], [], [], []]
        mock_session.exec.return_value.first.return_value = None

        result = simulation_attempts(str(simulation_id))

        assert len(result) == 4
        assert result[0]["student"] == "John Doe"
        assert result[1]["student"] == "Jane Smith"
        assert result[2]["student"] == "Bob Johnson"
        assert result[3]["student"] == "John Doe"

    def test_simulation_attempts_attempt_details(self, mock_get_session):
        """Test simulation_attempts with detailed attempt information."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")

        profile_id = uuid.uuid4()
        attempt_id = uuid.uuid4()
        base_time = datetime.now()

        mock_attempt = MockSimulationAttempt(
            attempt_id, base_time, profile_id, simulation_id
        )
        mock_profile = MockProfile(profile_id, "John", "Doe")

        mock_session.get.side_effect = [mock_simulation, mock_profile]
        mock_session.exec.return_value.all.side_effect = [[mock_attempt], []]
        mock_session.exec.return_value.first.return_value = None

        result = simulation_attempts(str(simulation_id))

        assert len(result) == 1
        attempt = result[0]
        assert attempt["id"] == str(attempt_id)
        assert attempt["student_id"] == str(profile_id)
        assert attempt["student"] == "John Doe"

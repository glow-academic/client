"""
Tests for app.services.mcp.tools.analytics.simulation_attempts
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.analytics.simulation_attempts import \
    simulation_attempts
from sqlalchemy.exc import SQLAlchemyError


class MockSimulation:
    def __init__(self, id, title):
        self.id = id
        self.title = title


class MockSimulationAttempt:
    def __init__(self, id, created_at, profile_id=None):
        self.id = id
        self.created_at = created_at
        self.profile_id = profile_id or uuid.uuid4()


class MockProfile:
    def __init__(self, id, first_name, last_name):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name


@patch("app.services.mcp.tools.analytics.simulation_attempts.get_session")
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
            MockSimulationAttempt(uuid.uuid4(), base_time, profile1_id),
            MockSimulationAttempt(uuid.uuid4(), base_time + timedelta(hours=1), profile2_id),
            MockSimulationAttempt(uuid.uuid4(), base_time + timedelta(hours=2), profile1_id),
        ]
        
        mock_profiles = [
            MockProfile(profile1_id, "John", "Doe"),
            MockProfile(profile2_id, "Jane", "Smith"),
        ]
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.all.return_value = mock_attempts
        mock_session.exec.return_value.first.return_value = mock_profiles[0]
        
        result = simulation_attempts(str(simulation_id))
        
        assert result["simulation"]["id"] == str(simulation_id)
        assert result["simulation"]["title"] == "Conflict Resolution"
        assert len(result["attempts"]) == 3
        assert result["total_attempts"] == 3
        assert result["unique_students"] == 2

    def test_simulation_attempts_error(self, mock_get_session):
        """Test simulation_attempts error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")
        
        result = simulation_attempts(str(simulation_id))
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_simulation_attempts_simulation_not_found(self, mock_get_session):
        """Test simulation_attempts with non-existent simulation."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        mock_session.get.return_value = None
        
        result = simulation_attempts(str(simulation_id))
        
        assert "error" in result
        assert "Simulation not found" in result["error"]

    def test_simulation_attempts_invalid_uuid(self, mock_get_session):
        """Test simulation_attempts with invalid UUID."""
        result = simulation_attempts("invalid-uuid")
        
        assert "error" in result
        assert "Invalid simulation_id format" in result["error"]

    def test_simulation_attempts_no_attempts(self, mock_get_session):
        """Test simulation_attempts with no attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.all.return_value = []
        
        result = simulation_attempts(str(simulation_id))
        
        assert result["simulation"]["id"] == str(simulation_id)
        assert result["attempts"] == []
        assert result["total_attempts"] == 0
        assert result["unique_students"] == 0

    def test_simulation_attempts_single_student(self, mock_get_session):
        """Test simulation_attempts with single student multiple attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        
        profile_id = uuid.uuid4()
        base_time = datetime.now()
        
        mock_attempts = [
            MockSimulationAttempt(uuid.uuid4(), base_time, profile_id),
            MockSimulationAttempt(uuid.uuid4(), base_time + timedelta(hours=1), profile_id),
            MockSimulationAttempt(uuid.uuid4(), base_time + timedelta(hours=2), profile_id),
        ]
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.all.return_value = mock_attempts
        mock_session.exec.return_value.first.return_value = MockProfile(profile_id, "John", "Doe")
        
        result = simulation_attempts(str(simulation_id))
        
        assert result["total_attempts"] == 3
        assert result["unique_students"] == 1

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
            MockSimulationAttempt(uuid.uuid4(), base_time, profile1_id),
            MockSimulationAttempt(uuid.uuid4(), base_time + timedelta(hours=1), profile2_id),
            MockSimulationAttempt(uuid.uuid4(), base_time + timedelta(hours=2), profile3_id),
            MockSimulationAttempt(uuid.uuid4(), base_time + timedelta(hours=3), profile1_id),
        ]
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.all.return_value = mock_attempts
        mock_session.exec.return_value.first.return_value = MockProfile(profile1_id, "John", "Doe")
        
        result = simulation_attempts(str(simulation_id))
        
        assert result["total_attempts"] == 4
        assert result["unique_students"] == 3

    def test_simulation_attempts_attempt_details(self, mock_get_session):
        """Test simulation_attempts with detailed attempt information."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        
        profile_id = uuid.uuid4()
        attempt_id = uuid.uuid4()
        base_time = datetime.now()
        
        mock_attempt = MockSimulationAttempt(attempt_id, base_time, profile_id)
        mock_profile = MockProfile(profile_id, "John", "Doe")
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.all.return_value = [mock_attempt]
        mock_session.exec.return_value.first.return_value = mock_profile
        
        result = simulation_attempts(str(simulation_id))
        
        assert len(result["attempts"]) == 1
        attempt = result["attempts"][0]
        assert attempt["id"] == str(attempt_id)
        assert attempt["profile"]["id"] == str(profile_id)
        assert attempt["profile"]["first_name"] == "John"
        assert attempt["profile"]["last_name"] == "Doe"

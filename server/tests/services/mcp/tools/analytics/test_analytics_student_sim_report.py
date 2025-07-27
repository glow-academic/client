"""
Tests for app.services.mcp.tools.analytics.student_sim_report
"""

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.analytics.student_sim_report import \
    student_sim_report
from sqlalchemy.exc import SQLAlchemyError


class MockProfile:
    def __init__(self, id, first_name, last_name, alias):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.alias = alias


class MockSimulation:
    def __init__(self, id, title):
        self.id = id
        self.title = title


class MockSimulationAttempt:
    def __init__(self, id, created_at, simulation_id):
        self.id = id
        self.created_at = created_at
        self.simulation_id = simulation_id


class MockSimulationChat:
    def __init__(self, id, attempt_id, created_at, completed_at=None):
        self.id = id
        self.attempt_id = attempt_id
        self.created_at = created_at
        self.completed_at = completed_at


class MockSimulationChatGrade:
    def __init__(self, id, score, passed, time_taken):
        self.id = id
        self.score = score
        self.passed = passed
        self.time_taken = time_taken


@patch("app.services.mcp.tools.analytics.student_sim_report.get_session")
class TestStudent_Sim_Report:
    """Tests for student_sim_report function."""

    def test_student_sim_report_success(self, mock_get_session):
        """Test successful student_sim_report execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Conflict Resolution")
        
        base_time = datetime.now()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_attempt = MockSimulationAttempt(attempt_id, base_time, simulation_id)
        mock_chat = MockSimulationChat(chat_id, attempt_id, base_time, base_time + timedelta(minutes=5))
        mock_grade = MockSimulationChatGrade(uuid.uuid4(), 85, True, 300)
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = [mock_attempt]
        mock_session.exec.return_value.first.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_chat
        mock_session.exec.return_value.first.return_value = mock_grade
        
        result = student_sim_report(str(profile_id))
        
        assert result["profile"]["id"] == str(profile_id)
        assert result["profile"]["first_name"] == "John"
        assert result["profile"]["last_name"] == "Doe"
        assert result["profile"]["alias"] == "jdoe"
        assert "simulation_reports" in result
        assert len(result["simulation_reports"]) == 1

    def test_student_sim_report_error(self, mock_get_session):
        """Test student_sim_report error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")
        
        result = student_sim_report(str(profile_id))
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_student_sim_report_profile_not_found(self, mock_get_session):
        """Test student_sim_report with non-existent profile."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_session.get.return_value = None
        
        result = student_sim_report(str(profile_id))
        
        assert "error" in result
        assert "Profile not found" in result["error"]

    def test_student_sim_report_invalid_uuid(self, mock_get_session):
        """Test student_sim_report with invalid UUID."""
        result = student_sim_report("invalid-uuid")
        
        assert "error" in result
        assert "Invalid profile_id format" in result["error"]

    def test_student_sim_report_no_attempts(self, mock_get_session):
        """Test student_sim_report with no attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = []
        
        result = student_sim_report(str(profile_id))
        
        assert result["profile"]["id"] == str(profile_id)
        assert result["simulation_reports"] == []

    def test_student_sim_report_multiple_attempts(self, mock_get_session):
        """Test student_sim_report with multiple attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        
        base_time = datetime.now()
        attempt1_id = uuid.uuid4()
        attempt2_id = uuid.uuid4()
        
        mock_attempt1 = MockSimulationAttempt(attempt1_id, base_time, simulation_id)
        mock_attempt2 = MockSimulationAttempt(attempt2_id, base_time + timedelta(hours=1), simulation_id)
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = [mock_attempt1, mock_attempt2]
        mock_session.exec.return_value.first.return_value = mock_simulation
        
        result = student_sim_report(str(profile_id))
        
        assert len(result["simulation_reports"]) == 1
        simulation_report = result["simulation_reports"][0]
        assert simulation_report["simulation"]["id"] == str(simulation_id)
        assert len(simulation_report["attempts"]) == 2

    def test_student_sim_report_with_grades(self, mock_get_session):
        """Test student_sim_report with grade information."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        
        base_time = datetime.now()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_attempt = MockSimulationAttempt(attempt_id, base_time, simulation_id)
        mock_chat = MockSimulationChat(chat_id, attempt_id, base_time, base_time + timedelta(minutes=5))
        mock_grade = MockSimulationChatGrade(uuid.uuid4(), 90, True, 300)
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = [mock_attempt]
        mock_session.exec.return_value.first.side_effect = [mock_simulation, mock_chat, mock_grade]
        
        result = student_sim_report(str(profile_id))
        
        assert len(result["simulation_reports"]) == 1
        simulation_report = result["simulation_reports"][0]
        assert len(simulation_report["attempts"]) == 1
        
        attempt = simulation_report["attempts"][0]
        assert attempt["grade"]["score"] == 90
        assert attempt["grade"]["passed"] is True
        assert attempt["grade"]["time_taken"] == 300

    def test_student_sim_report_no_grade(self, mock_get_session):
        """Test student_sim_report with attempt but no grade."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        
        base_time = datetime.now()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_attempt = MockSimulationAttempt(attempt_id, base_time, simulation_id)
        mock_chat = MockSimulationChat(chat_id, attempt_id, base_time, base_time + timedelta(minutes=5))
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = [mock_attempt]
        mock_session.exec.return_value.first.side_effect = [mock_simulation, mock_chat, None]  # No grade
        
        result = student_sim_report(str(profile_id))
        
        assert len(result["simulation_reports"]) == 1
        simulation_report = result["simulation_reports"][0]
        attempt = simulation_report["attempts"][0]
        assert attempt["grade"] is None

    def test_student_sim_report_multiple_simulations(self, mock_get_session):
        """Test student_sim_report with multiple simulations."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation1_id = uuid.uuid4()
        simulation2_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation1 = MockSimulation(simulation1_id, "Simulation 1")
        mock_simulation2 = MockSimulation(simulation2_id, "Simulation 2")
        
        base_time = datetime.now()
        attempt1_id = uuid.uuid4()
        attempt2_id = uuid.uuid4()
        
        mock_attempt1 = MockSimulationAttempt(attempt1_id, base_time, simulation1_id)
        mock_attempt2 = MockSimulationAttempt(attempt2_id, base_time + timedelta(hours=1), simulation2_id)
        
        mock_session.get.return_value = mock_profile
        mock_session.exec.return_value.all.return_value = [mock_attempt1, mock_attempt2]
        mock_session.exec.return_value.first.side_effect = [mock_simulation1, mock_simulation2]
        
        result = student_sim_report(str(profile_id))
        
        assert len(result["simulation_reports"]) == 2
        assert result["simulation_reports"][0]["simulation"]["id"] == str(simulation1_id)
        assert result["simulation_reports"][1]["simulation"]["id"] == str(simulation2_id)

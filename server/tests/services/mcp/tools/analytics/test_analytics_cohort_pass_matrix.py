"""
Tests for app.services.mcp.tools.analytics.cohort_pass_matrix
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.analytics.cohort_pass_matrix import \
    cohort_pass_matrix
from sqlalchemy.exc import SQLAlchemyError


class MockCohort:
    def __init__(self, id, title, description="", active=True, profile_ids=None, simulation_ids=None):
        self.id = id
        self.title = title
        self.description = description
        self.active = active
        self.profile_ids = profile_ids or []
        self.simulation_ids = simulation_ids or []
        self.created_at = datetime.now()


class MockSimulation:
    def __init__(self, id, title, active=True, time_limit=30):
        self.id = id
        self.title = title
        self.active = active
        self.time_limit = time_limit


class MockProfile:
    def __init__(self, id, first_name, last_name, alias="test_alias"):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.alias = alias


class MockSimulationAttempt:
    def __init__(self, id, profile_id, simulation_id, created_at=None):
        self.id = id
        self.profile_id = profile_id
        self.simulation_id = simulation_id
        self.created_at = created_at or datetime.now()


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


@patch("app.services.mcp.tools.analytics.cohort_pass_matrix.get_session")
class TestCohort_Pass_Matrix:
    """Tests for cohort_pass_matrix function."""

    def test_cohort_pass_matrix_invalid_uuid(self, mock_get_session):
        """Test cohort_pass_matrix with invalid UUID."""
        result = cohort_pass_matrix("invalid-uuid")
        
        assert "error" in result
        assert "Invalid cohort_id format" in result["error"]

    def test_cohort_pass_matrix_cohort_not_found(self, mock_get_session):
        """Test cohort_pass_matrix with non-existent cohort."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        cohort_id = uuid.uuid4()
        mock_session.get.return_value = None
        
        result = cohort_pass_matrix(str(cohort_id))
        
        assert "error" in result
        assert "Cohort not found" in result["error"]

    def test_cohort_pass_matrix_error(self, mock_get_session):
        """Test cohort_pass_matrix error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        cohort_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")
        
        result = cohort_pass_matrix(str(cohort_id))
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_cohort_pass_matrix_success(self, mock_get_session):
        """Test successful cohort_pass_matrix execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        cohort_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        profile_id = uuid.uuid4()
        
        mock_cohort = MockCohort(cohort_id, "Test Cohort", profile_ids=[profile_id], simulation_ids=[simulation_id])
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        mock_profile = MockProfile(profile_id, "John", "Doe")
        mock_attempt = MockSimulationAttempt(uuid.uuid4(), profile_id, simulation_id)
        mock_chat = MockSimulationChat(uuid.uuid4(), mock_attempt.id)
        mock_grade = MockSimulationChatGrade(uuid.uuid4(), 85, True)
        
        mock_session.get.side_effect = [mock_cohort, mock_profile, mock_simulation]
        mock_session.exec.return_value.all.side_effect = [[mock_attempt], [mock_chat]]
        mock_session.exec.return_value.first.return_value = mock_grade
        
        result = cohort_pass_matrix(str(cohort_id))
        
        assert result["cohort"]["id"] == str(cohort_id)
        assert result["cohort"]["title"] == "Test Cohort"
        assert "matrix" in result
        assert "summary" in result
        assert len(result["matrix"]) == 1

    def test_cohort_pass_matrix_no_simulations(self, mock_get_session):
        """Test cohort_pass_matrix with no simulations."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        cohort_id = uuid.uuid4()
        mock_cohort = MockCohort(cohort_id, "Test Cohort", simulation_ids=[])
        
        mock_session.get.return_value = mock_cohort
        
        result = cohort_pass_matrix(str(cohort_id))
        
        assert result["cohort"]["id"] == str(cohort_id)
        assert result["matrix"] == []
        assert result["summary"]["total_simulations"] == 0

    def test_cohort_pass_matrix_multiple_simulations(self, mock_get_session):
        """Test cohort_pass_matrix with multiple simulations."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        cohort_id = uuid.uuid4()
        simulation1_id = uuid.uuid4()
        simulation2_id = uuid.uuid4()
        
        mock_cohort = MockCohort(cohort_id, "Test Cohort", simulation_ids=[simulation1_id, simulation2_id])
        mock_simulation1 = MockSimulation(simulation1_id, "Simulation 1")
        mock_simulation2 = MockSimulation(simulation2_id, "Simulation 2")
        
        mock_session.get.side_effect = [mock_cohort, mock_simulation1, mock_simulation2]
        
        result = cohort_pass_matrix(str(cohort_id))
        
        assert len(result["simulations"]) == 2
        assert result["simulations"][0]["id"] == str(simulation1_id)
        assert result["simulations"][1]["id"] == str(simulation2_id)

    def test_cohort_pass_matrix_with_student_data(self, mock_get_session):
        """Test cohort_pass_matrix with student performance data."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        cohort_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        profile1_id = uuid.uuid4()
        profile2_id = uuid.uuid4()
        
        mock_cohort = MockCohort(cohort_id, "Test Cohort", 
                                profile_ids=[profile1_id, profile2_id], 
                                simulation_ids=[simulation_id])
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        mock_profile1 = MockProfile(profile1_id, "John", "Doe")
        mock_profile2 = MockProfile(profile2_id, "Jane", "Smith")
        mock_attempt1 = MockSimulationAttempt(uuid.uuid4(), profile1_id, simulation_id)
        mock_attempt2 = MockSimulationAttempt(uuid.uuid4(), profile2_id, simulation_id)
        mock_chat1 = MockSimulationChat(uuid.uuid4(), mock_attempt1.id)
        mock_chat2 = MockSimulationChat(uuid.uuid4(), mock_attempt2.id)
        mock_grade1 = MockSimulationChatGrade(uuid.uuid4(), 85, True)
        mock_grade2 = MockSimulationChatGrade(uuid.uuid4(), 65, False)
        
        mock_session.get.side_effect = [mock_cohort, mock_profile1, mock_profile2, mock_simulation]
        mock_session.exec.return_value.all.side_effect = [[mock_attempt1], [mock_chat1], [mock_attempt2], [mock_chat2]]
        mock_session.exec.return_value.first.side_effect = [mock_grade1, mock_grade2]
        
        result = cohort_pass_matrix(str(cohort_id))
        
        assert len(result["matrix"]) == 2
        assert result["matrix"][0]["student_name"] == "John Doe"
        assert result["matrix"][0]["simulations"][str(simulation_id)]["passed"] is True
        assert result["matrix"][1]["student_name"] == "Jane Smith"
        assert result["matrix"][1]["simulations"][str(simulation_id)]["passed"] is False

    def test_cohort_pass_matrix_empty_student_list(self, mock_get_session):
        """Test cohort_pass_matrix with empty student list."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        cohort_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        
        mock_cohort = MockCohort(cohort_id, "Test Cohort", 
                                profile_ids=[], 
                                simulation_ids=[simulation_id])
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        
        mock_session.get.side_effect = [mock_cohort, mock_simulation]
        
        result = cohort_pass_matrix(str(cohort_id))
        
        assert result["matrix"] == []
        assert result["summary"]["total_students"] == 0

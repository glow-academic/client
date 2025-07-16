# test_cohort_pass_matrix.py

import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import SQLAlchemyError
from app.models import Cohorts, Profiles, Simulations, SimulationAttempts, SimulationChats, SimulationChatGrades
from app.services.mcp.tools.analytics.cohort_pass_matrix import cohort_pass_matrix

COHORT_ID = uuid.uuid4()
STUDENT_1_ID = uuid.uuid4()
STUDENT_2_ID = uuid.uuid4()
SIM_1_ID = uuid.uuid4()

@pytest.fixture(autouse=True)
def patch_db_session(mocker, test_session):
    """Ensure the function under test uses the test_session."""
    mocker.patch('app.services.mcp.tools.analytics.cohort_pass_matrix.get_session', return_value=iter([test_session]))


class TestCohortPassMatrix:
    """Tests for cohort_pass_matrix function."""

    def test_success_with_data(self, test_session):
        """Test successful execution with cohort data."""
        # Arrange
        student1 = Profiles(id=STUDENT_1_ID, first_name="Jane", last_name="Doe")
        student2 = Profiles(id=STUDENT_2_ID, alias="Matrixer")
        cohort = Cohorts(id=COHORT_ID, title="Test Cohort", profile_ids=[STUDENT_1_ID, STUDENT_2_ID])
        sim = Simulations(id=SIM_1_ID, title="Matrix Sim", cohort_ids=[COHORT_ID])

        # Student 1 passes
        attempt_s1 = SimulationAttempts(profile_id=STUDENT_1_ID, simulation_id=SIM_1_ID)
        chat_s1 = SimulationChats(attempt_id=attempt_s1.id)
        grade_s1 = SimulationChatGrades(simulation_chat_id=chat_s1.id, score=90, passed=True)

        # Student 2 fails
        attempt_s2 = SimulationAttempts(profile_id=STUDENT_2_ID, simulation_id=SIM_1_ID)
        chat_s2 = SimulationChats(attempt_id=attempt_s2.id)
        grade_s2 = SimulationChatGrades(simulation_chat_id=chat_s2.id, score=60, passed=False)

        test_session.add_all([student1, student2, cohort, sim, attempt_s1, chat_s1, grade_s1, attempt_s2, chat_s2, grade_s2])
        test_session.commit()

        # Act
        result = cohort_pass_matrix(str(COHORT_ID))

        # Assert
        assert "error" not in result
        assert result["cohort"]["id"] == str(COHORT_ID)
        assert len(result["matrix"]) == 2
        assert result["summary"]["total_students"] == 2
        
        sim_stats = result["summary"]["simulation_stats"][str(SIM_1_ID)]
        assert sim_stats["attempted_count"] == 2
        assert sim_stats["passed_count"] == 1
        assert sim_stats["pass_rate"] == 50.0
        assert sim_stats["average_score"] == 75.0 # (90 + 60) / 2

        student1_result = next(s for s in result["matrix"] if s["student_id"] == str(STUDENT_1_ID))
        assert student1_result["simulations"][str(SIM_1_ID)]["passed"] is True

    def test_cohort_not_found(self, test_session):
        """Test case where the cohort_id does not exist."""
        non_existent_id = str(uuid.uuid4())
        result = cohort_pass_matrix(non_existent_id)
        assert result == {"error": f"Cohort not found: {non_existent_id}"}

    def test_cohort_with_no_members(self, test_session):
        """Test case where a cohort exists but has no members."""
        cohort = Cohorts(id=COHORT_ID, title="Empty Cohort", profile_ids=[])
        test_session.add(cohort)
        test_session.commit()

        result = cohort_pass_matrix(str(COHORT_ID))
        assert "error" not in result
        assert result["summary"]["total_students"] == 0
        assert result["matrix"] == []

    def test_pass_rate_zero_division(self, test_session):
        """Test that pass_rate is 0 when no one has attempted the sim to avoid ZeroDivisionError."""
        student = Profiles(id=STUDENT_1_ID, first_name="No", last_name="Show")
        cohort = Cohorts(id=COHORT_ID, title="Test Cohort", profile_ids=[STUDENT_1_ID])
        sim = Simulations(id=SIM_1_ID, title="Unattempted Sim", cohort_ids=[COHORT_ID])
        test_session.add_all([student, cohort, sim])
        test_session.commit()

        result = cohort_pass_matrix(str(COHORT_ID))
        assert "error" not in result
        sim_stats = result["summary"]["simulation_stats"][str(SIM_1_ID)]
        assert sim_stats["attempted_count"] == 0
        assert sim_stats["pass_rate"] == 0
        assert sim_stats["average_score"] == 0

    def test_database_error(self, mocker):
        """Test handling of a SQLAlchemyError."""
        mock_session = MagicMock()
        mock_session.get.side_effect = SQLAlchemyError("Connection failed")
        mocker.patch('app.services.mcp.tools.analytics.cohort_pass_matrix.get_session', return_value=iter([mock_session]))

        result = cohort_pass_matrix(str(COHORT_ID))
        assert "error" in result
        assert "Database error" in result["error"]

import pytest

@pytest.mark.skip(reason="TODO: implement tests for `cohort_pass_matrix`")
class TestCohort_Pass_Matrix:
    """Tests for cohort_pass_matrix function."""

    def test_cohort_pass_matrix_success(self):
        """Test successful cohort_pass_matrix execution."""
        # TODO: Implement test for cohort_pass_matrix
        assert False, "IMPLEMENT: Test for cohort_pass_matrix"

    def test_cohort_pass_matrix_error(self):
        """Test cohort_pass_matrix error handling."""
        # TODO: Implement error test for cohort_pass_matrix
        assert False, "IMPLEMENT: Error test for cohort_pass_matrix"


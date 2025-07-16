# test_simulation_attempts.py

import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import SQLAlchemyError
from app.models import Profiles, Simulations, SimulationAttempts, SimulationChats, SimulationChatGrades
from app.services.mcp.tools.analytics.simulation_attempts import simulation_attempts

SIM_ID = uuid.uuid4()
STUDENT_1_ID = uuid.uuid4()
STUDENT_2_ID = uuid.uuid4()

@pytest.fixture(autouse=True)
def patch_db_session(mocker, test_session):
    """Ensure the function under test uses the test_session."""
    mocker.patch('app.services.mcp.tools.analytics.simulation_attempts.get_session', return_value=iter([test_session]))

class TestSimulationAttempts:
    """Tests for simulation_attempts function."""

    def test_success_with_data(self, test_session):
        """Test successful execution with multiple attempts."""
        # Arrange
        sim = Simulations(id=SIM_ID, title="Attempt Sim")
        student1 = Profiles(id=STUDENT_1_ID, first_name="Attempter", last_name="One")
        student2 = Profiles(id=STUDENT_2_ID, alias="Two")

        # Create attempts with different creation times to test sorting
        attempt1 = SimulationAttempts(profile_id=STUDENT_1_ID, simulation_id=SIM_ID, created_at=datetime.now() - timedelta(minutes=10))
        chat1 = SimulationChats(attempt_id=attempt1.id)
        grade1 = SimulationChatGrades(simulation_chat_id=chat1.id, score=85, passed=True)

        attempt2 = SimulationAttempts(profile_id=STUDENT_2_ID, simulation_id=SIM_ID, created_at=datetime.now()) # Most recent
        chat2 = SimulationChats(attempt_id=attempt2.id)
        grade2 = SimulationChatGrades(simulation_chat_id=chat2.id, score=95, passed=True)

        test_session.add_all([sim, student1, student2, attempt1, chat1, grade1, attempt2, chat2, grade2])
        test_session.commit()

        # Act
        result = simulation_attempts(str(SIM_ID))

        # Assert
        assert isinstance(result, list)
        assert len(result) == 2
        assert "error" not in result[0]
        
        # Check that the most recent attempt is first
        assert result[0]["student_id"] == str(STUDENT_2_ID)
        assert result[0]["score"] == 95
        assert result[1]["student"] == "Attempter One"
        assert result[1]["score"] == 85

    def test_limit_parameter(self, test_session):
        """Test that the limit parameter correctly restricts the number of results."""
        sim = Simulations(id=SIM_ID, title="Limit Test Sim")
        student = Profiles(id=STUDENT_1_ID, first_name="Test")
        test_session.add_all([sim, student])
        # Add 3 attempts
        for i in range(3):
            attempt = SimulationAttempts(profile_id=STUDENT_1_ID, simulation_id=SIM_ID, created_at=datetime.now() - timedelta(minutes=i))
            test_session.add(attempt)
        test_session.commit()

        result = simulation_attempts(str(SIM_ID), limit=2)
        assert len(result) == 2

    def test_simulation_not_found(self, test_session):
        """Test case where the sim_id does not exist."""
        non_existent_id = str(uuid.uuid4())
        result = simulation_attempts(non_existent_id)
        assert result == [{"error": f"Simulation not found: {non_existent_id}"}]

    def test_simulation_with_no_attempts(self, test_session):
        """Test case where a simulation exists but has no attempts."""
        sim = Simulations(id=SIM_ID, title="No Attempts Sim")
        test_session.add(sim)
        test_session.commit()
        
        result = simulation_attempts(str(SIM_ID))
        assert result == []

    def test_database_error(self, mocker):
        """Test handling of a SQLAlchemyError."""
        mock_session = MagicMock()
        mock_session.get.side_effect = SQLAlchemyError("Connection failed")
        mocker.patch('app.services.mcp.tools.analytics.simulation_attempts.get_session', return_value=iter([mock_session]))

        result = simulation_attempts(str(SIM_ID))
        assert result == [{"error": "Database error: Connection failed"}]

import pytest

@pytest.mark.skip(reason="TODO: implement tests for `simulation_attempts`")
class TestSimulation_Attempts:
    """Tests for simulation_attempts function."""

    def test_simulation_attempts_success(self):
        """Test successful simulation_attempts execution."""
        # TODO: Implement test for simulation_attempts
        assert False, "IMPLEMENT: Test for simulation_attempts"

    def test_simulation_attempts_error(self):
        """Test simulation_attempts error handling."""
        # TODO: Implement error test for simulation_attempts
        assert False, "IMPLEMENT: Error test for simulation_attempts"


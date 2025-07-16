# test_simulation_attempts.py
import uuid
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest
from app.services.mcp.tools.analytics.simulation_attempts import simulation_attempts

# Mock classes to simulate SQLModel objects
class MockSimulation:
    def __init__(self, id): self.id = id

class MockProfile:
    def __init__(self, id, first_name, last_name, alias):
        self.id, self.first_name, self.last_name, self.alias = id, first_name, last_name, alias

class MockAttempt:
    def __init__(self, id, profile_id, created_at):
        self.id, self.profile_id, self.created_at = id, profile_id, created_at

class MockChat:
    def __init__(self, id, attempt_id, created_at):
        self.id, self.attempt_id, self.created_at = id, attempt_id, created_at

class MockGrade:
    def __init__(self, sim_chat_id, score, passed, time_taken):
        self.simulation_chat_id, self.score, self.passed, self.time_taken = sim_chat_id, score, passed, time_taken

@pytest.fixture
def mock_db_session():
    return MagicMock()

@patch('app.services.mcp.tools.analytics.simulation_attempts.get_session')
class TestSimulationAttempts:
    """Tests for simulation_attempts function using a mocked session."""

    def test_success_with_data(self, mock_get_session, mock_db_session):
        mock_get_session.return_value = iter([mock_db_session])
        sim_id, student1_id, student2_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

        # 1. Mock simulation and profile fetches
        mock_sim = MockSimulation(sim_id)
        mock_student1 = MockProfile(student1_id, "Attempter", "One", "a_one")
        mock_student2 = MockProfile(student2_id, "", "", "Two")
        mock_db_session.get.side_effect = [mock_sim, mock_student1, mock_student2]

        # 2. Mock attempts list
        attempt1 = MockAttempt(uuid.uuid4(), student1_id, datetime.now() - timedelta(minutes=10))
        attempt2 = MockAttempt(uuid.uuid4(), student2_id, datetime.now())
        mock_db_session.exec.return_value.all.return_value = [attempt1, attempt2]
        
        # 3. Mock chats and grades for each attempt
        chat1 = MockChat(uuid.uuid4(), attempt1.id, datetime.now())
        grade1 = MockGrade(chat1.id, 85, True, 100)
        chat2 = MockChat(uuid.uuid4(), attempt2.id, datetime.now())
        grade2 = MockGrade(chat2.id, 95, True, 90)

        # The function loops, so we configure side effects for the repeated calls
        all_side_effect_chat = [[chat2], [chat1]] # Note reversed order due to sorting in code
        first_side_effect_grade = [grade2, grade1]
        
        # This is tricky: we create a new mock for the exec() call inside the loop
        inner_exec_mock = MagicMock()
        inner_exec_mock.all.side_effect = all_side_effect_chat
        inner_exec_mock.first.side_effect = first_side_effect_grade
        # The outer exec() returns the attempts, the inner one (re-mocked) returns chat/grade info
        mock_db_session.exec.side_effect = [
            MagicMock(all=MagicMock(return_value=[attempt1, attempt2])), # First call to exec gets attempts
            inner_exec_mock, # Subsequent calls use the chat/grade mock
            inner_exec_mock
        ]

        # Act
        result = simulation_attempts(str(sim_id))
        
        # Assert
        assert len(result) == 2
        assert result[0]["score"] == 95 # Most recent attempt first
        assert result[1]["score"] == 85

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


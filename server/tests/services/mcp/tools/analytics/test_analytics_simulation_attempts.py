# test_simulation_attempts.py
import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.analytics.simulation_attempts import simulation_attempts


# Mock classes
class MockSimulation:
    def __init__(self, id):
        self.id = id


class MockProfile:
    def __init__(self, id, first_name, last_name, alias):
        self.id, self.first_name, self.last_name, self.alias = (
            id,
            first_name,
            last_name,
            alias,
        )


class MockAttempt:
    def __init__(self, id, profile_id, created_at):
        self.id, self.profile_id, self.created_at = id, profile_id, created_at


class MockChat:
    def __init__(self, id, attempt_id, created_at):
        self.id, self.attempt_id, self.created_at = id, attempt_id, created_at


class MockGrade:
    def __init__(self, sim_chat_id, score, passed, time_taken):
        self.simulation_chat_id, self.score, self.passed, self.time_taken = (
            sim_chat_id,
            score,
            passed,
            time_taken,
        )


@patch("app.services.mcp.tools.analytics.simulation_attempts.get_session")
class TestSimulationAttempts:
    def test_success_with_data(self, mock_get_session):
        mock_db_session = MagicMock()
        mock_get_session.return_value = iter([mock_db_session])
        sim_id, student1_id, student2_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

        mock_sim = MockSimulation(sim_id)
        mock_student1 = MockProfile(student1_id, "Attempter", "One", "a_one")
        mock_student2 = MockProfile(student2_id, "", "", "Two")
        mock_db_session.get.side_effect = [
            mock_sim,
            mock_student2,
            mock_student1,
        ]  # Order reflects calls in loop

        attempt1 = MockAttempt(
            uuid.uuid4(), student1_id, datetime.now() - timedelta(minutes=10)
        )
        attempt2 = MockAttempt(uuid.uuid4(), student2_id, datetime.now())

        chat1 = MockChat(uuid.uuid4(), attempt1.id, datetime.now())
        grade1 = MockGrade(chat1.id, 85, True, 100)
        chat2 = MockChat(uuid.uuid4(), attempt2.id, datetime.now())
        grade2 = MockGrade(chat2.id, 95, True, 90)

        # Corrected: Provide a side_effect list that matches the 1+2*N call pattern
        # The tool calls exec() for: 1. attempts, 2. chats_s2, 3. grade_s2, 4. chats_s1, 5. grade_s1
        mock_exec_results = [
            MagicMock(
                all=MagicMock(return_value=[attempt1, attempt2])
            ),  # Call 1: Get all attempts
            MagicMock(
                all=MagicMock(return_value=[chat2])
            ),  # Call 2: Get chats for attempt 2
            MagicMock(
                first=MagicMock(return_value=grade2)
            ),  # Call 3: Get grade for attempt 2
            MagicMock(
                all=MagicMock(return_value=[chat1])
            ),  # Call 4: Get chats for attempt 1
            MagicMock(
                first=MagicMock(return_value=grade1)
            ),  # Call 5: Get grade for attempt 1
        ]
        mock_db_session.exec.side_effect = mock_exec_results

        result = simulation_attempts(str(sim_id))

        assert len(result) == 2
        assert result[0]["score"] == 95  # Most recent attempt (attempt2)
        assert result[1]["score"] == 85




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

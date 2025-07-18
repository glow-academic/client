# test_student_sim_report.py
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest
from app.services.mcp.tools.analytics.student_sim_report import student_sim_report


# Mock classes to simulate SQLModel objects
class MockProfile:
    def __init__(self, id, first_name, last_name, alias, created_at, role="student"):
        (
            self.id,
            self.first_name,
            self.last_name,
            self.alias,
            self.created_at,
            self.role,
        ) = id, first_name, last_name, alias, created_at, role


class MockSimulation:
    def __init__(self, id, title):
        self.id, self.title = id, title


class MockScenario:
    def __init__(self, id, name, description=""):
        self.id, self.name, self.description = id, name, description


class MockStandard:
    def __init__(self, name):
        self.name = name


class MockAttempt:
    def __init__(self, id, simulation_id, created_at):
        self.id, self.simulation_id, self.created_at = id, simulation_id, created_at


class MockChat:
    def __init__(
        self,
        id,
        attempt_id,
        scenario_id,
        created_at,
        title,
        completed=True,
        completed_at=None,
    ):
        (
            self.id,
            self.attempt_id,
            self.scenario_id,
            self.created_at,
            self.title,
            self.completed,
            self.completed_at,
        ) = id, attempt_id, scenario_id, created_at, title, completed, completed_at


class MockMessage:
    def __init__(self, chat_id, type, content, created_at, completed=True):
        self.chat_id, self.type, self.content, self.created_at, self.completed = (
            chat_id,
            type,
            content,
            created_at,
            completed,
        )


class MockGrade:
    def __init__(self, id, score, passed, time_taken, created_at):
        self.id, self.score, self.passed, self.time_taken, self.created_at = (
            id,
            score,
            passed,
            time_taken,
            created_at,
        )


class MockFeedback:
    def __init__(self, standard, total, feedback):
        self.standard, self.total, self.feedback = standard, total, feedback


@pytest.fixture
def mock_db_session():
    return MagicMock()


@patch("app.services.mcp.tools.analytics.student_sim_report.get_session")
class TestStudentSimReport:
    """Tests for student_sim_report function using a mocked session."""

    def test_success_with_full_data(self, mock_get_session, mock_db_session):
        mock_get_session.return_value = iter([mock_db_session])
        profile_id, sim_id, scenario_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

        # 1. Mock Profile
        mock_profile = MockProfile(
            profile_id, "Detailed", "Student", "detail", datetime.now()
        )

        # 2. Mock related objects
        mock_sim = MockSimulation(sim_id, "Report Sim")
        mock_scenario = MockScenario(scenario_id, "Report Scenario")
        mock_attempt = MockAttempt(uuid.uuid4(), sim_id, datetime.now())
        mock_chat = MockChat(
            uuid.uuid4(), mock_attempt.id, scenario_id, datetime.now(), "Chat"
        )
        mock_msg = MockMessage(mock_chat.id, "query", "Query", datetime.now())
        mock_grade = MockGrade(uuid.uuid4(), 88, True, 123, datetime.now())
        mock_feedback = MockFeedback(MockStandard("Clarity"), 5, "Good job")

        # 3. Configure mock returns
        mock_db_session.get.side_effect = [mock_profile, mock_sim, mock_scenario]

        # Use a new mock for each `exec` call to control the chain
        exec_mock_attempts = MagicMock()
        exec_mock_attempts.all.return_value = [mock_attempt]

        exec_mock_chats = MagicMock()
        exec_mock_chats.all.return_value = [mock_chat]

        exec_mock_messages = MagicMock()
        exec_mock_messages.all.return_value = [mock_msg]

        exec_mock_grade = MagicMock()
        exec_mock_grade.first.return_value = mock_grade

        exec_mock_feedback = MagicMock()
        exec_mock_feedback.all.return_value = [(mock_feedback, mock_feedback.standard)]

        mock_db_session.exec.side_effect = [
            exec_mock_attempts,
            exec_mock_chats,
            exec_mock_messages,
            exec_mock_grade,
            exec_mock_feedback,
        ]

        # Act
        result = student_sim_report(str(profile_id))

        # Assert
        assert "error" not in result
        assert result["profile"]["id"] == str(profile_id)
        assert len(result["attempts"]) == 1
        assert result["attempts"][0]["chat"]["grade"]["score"] == 88
        assert result["attempts"][0]["chat"]["feedback"][0]["standard"] == "Clarity"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `student_sim_report`")
class TestStudent_Sim_Report:
    """Tests for student_sim_report function."""

    def test_student_sim_report_success(self):
        """Test successful student_sim_report execution."""
        # TODO: Implement test for student_sim_report
        assert False, "IMPLEMENT: Test for student_sim_report"

    def test_student_sim_report_error(self):
        """Test student_sim_report error handling."""
        # TODO: Implement error test for student_sim_report
        assert False, "IMPLEMENT: Error test for student_sim_report"

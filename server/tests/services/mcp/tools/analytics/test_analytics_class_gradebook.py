# tests/services/mcp/tools/analytics/test_analytics_class_gradebook.py (Corrected)
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.analytics.class_gradebook import class_gradebook


# Mock classes to simulate SQLModel objects
class MockClass:
    def __init__(self, id, name, class_code, year, term, description, profile_ids=None):
        self.id, self.name, self.class_code, self.year, self.term, self.description = (
            id,
            name,
            class_code,
            year,
            term,
            description,
        )
        self.profile_ids = profile_ids or []


class MockProfile:
    def __init__(self, id, first_name, last_name, alias, role="student", active=True):
        self.id, self.first_name, self.last_name, self.alias, self.role, self.active = (
            id,
            first_name,
            last_name,
            alias,
            role,
            active,
        )


class MockSimulation:
    def __init__(self, id, title, active=True, time_limit=60):
        self.id, self.title, self.active, self.time_limit = (
            id,
            title,
            active,
            time_limit,
        )


class MockAttempt:
    def __init__(self, id, profile_id, simulation_id, created_at):
        self.id, self.profile_id, self.simulation_id, self.created_at = (
            id,
            profile_id,
            simulation_id,
            created_at,
        )


class MockChat:
    def __init__(self, id, attempt_id, created_at):
        self.id, self.attempt_id, self.created_at = id, attempt_id, created_at


class MockGrade:
    def __init__(self, sim_chat_id, score, passed, time_taken):
        self.id, self.simulation_chat_id, self.score, self.passed, self.time_taken = (
            uuid.uuid4(),
            sim_chat_id,
            score,
            passed,
            time_taken,
        )


@patch("app.services.mcp.tools.analytics.class_gradebook.get_session")
class TestClassGradebook:
    def test_success_with_data(self, mock_get_session):
        mock_db_session = MagicMock()
        mock_get_session.return_value = iter([mock_db_session])
        class_id, student1_id, student2_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        sim1_id, sim2_id = uuid.uuid4(), uuid.uuid4()

        mock_class = MockClass(
            class_id,
            "CS101",
            "F25-CS101",
            2025,
            "fall",
            "Intro to CS",
            profile_ids=[student1_id, student2_id],
        )
        mock_db_session.get.return_value = mock_class

        mock_students = [
            MockProfile(student1_id, "John", "Doe", "jdoe"),
            MockProfile(student2_id, "", "", "Testy"),
        ]
        mock_sims = [
            MockSimulation(sim1_id, "Sim Alpha"),
            MockSimulation(sim2_id, "Sim Beta"),
        ]

        attempt1_s1 = MockAttempt(uuid.uuid4(), student1_id, sim1_id, datetime.now())
        chat1_s1 = MockChat(uuid.uuid4(), attempt1_s1.id, datetime.now())
        grade1_s1 = MockGrade(chat1_s1.id, 80, True, 100)

        attempt2_s1 = MockAttempt(uuid.uuid4(), student1_id, sim1_id, datetime.now())
        chat2_s1 = MockChat(uuid.uuid4(), attempt2_s1.id, datetime.now())
        grade2_s1 = MockGrade(chat2_s1.id, 95, True, 90)

        attempt1_s2 = MockAttempt(uuid.uuid4(), student2_id, sim2_id, datetime.now())
        chat1_s2 = MockChat(uuid.uuid4(), attempt1_s2.id, datetime.now())
        grade1_s2 = MockGrade(chat1_s2.id, 70, False, 120)

        # Corrected: Create separate mocks for each call to session.exec()
        # This prevents the side_effect iterators from being mixed up.
        mock_exec_all_results = [
            [],  # cohorts
            mock_students,
            mock_sims,
            [attempt1_s1, attempt2_s1],  # student 1 attempts
            [chat1_s1],  # chats for attempt1_s1
            [chat2_s1],  # chats for attempt2_s1
            [attempt1_s2],  # student 2 attempts
            [chat1_s2],  # chats for attempt1_s2
            # has_class_attempts checks
            [attempt1_s1, attempt2_s1],
            [],
            [],
            [attempt1_s2],
        ]
        mock_exec_first_results = [
            grade1_s1,  # grade for chat1_s1
            grade2_s1,  # grade for chat2_s1
            grade1_s2,  # grade for chat1_s2
        ]

        # Configure exec to return an object that has its own side_effects
        mock_db_session.exec.return_value.all.side_effect = mock_exec_all_results
        mock_db_session.exec.return_value.first.side_effect = mock_exec_first_results

        result = class_gradebook(str(class_id))

        assert "error" not in result
        assert result["student_count"] == 2
        student1_grades = next(
            s for s in result["students"] if s["id"] == str(student1_id)
        )
        assert student1_grades["grades"][str(sim1_id)]["score"] == 95




@pytest.mark.skip(reason="TODO: implement tests for `class_gradebook`")
class TestClass_Gradebook:
    """Tests for class_gradebook function."""

    def test_class_gradebook_success(self):
        """Test successful class_gradebook execution."""
        # TODO: Implement test for class_gradebook
        assert False, "IMPLEMENT: Test for class_gradebook"

    def test_class_gradebook_error(self):
        """Test class_gradebook error handling."""
        # TODO: Implement error test for class_gradebook
        assert False, "IMPLEMENT: Error test for class_gradebook"

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
    def __init__(self, id, first_name, last_name, alias, role="student"):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.alias = alias
        self.role = role
        self.created_at = datetime.now()


class MockSimulation:
    def __init__(self, id, title, active=True):
        self.id = id
        self.title = title
        self.active = active


class MockSimulationAttempt:
    def __init__(self, id, created_at, simulation_id, profile_id=None):
        self.id = id
        self.created_at = created_at
        self.simulation_id = simulation_id
        self.profile_id = profile_id or uuid.uuid4()


class MockSimulationChat:
    def __init__(self, id, attempt_id, scenario_id, created_at=None, completed_at=None, completed=False):
        self.id = id
        self.attempt_id = attempt_id
        self.scenario_id = scenario_id
        self.created_at = created_at or datetime.now()
        self.completed_at = completed_at
        self.completed = completed
        self.title = "Test Chat"


class MockScenario:
    def __init__(self, id, name, description="Test scenario"):
        self.id = id
        self.name = name
        self.description = description


class MockSimulationMessage:
    def __init__(self, id, chat_id, content, type="query", created_at=None, completed=True):
        self.id = id
        self.chat_id = chat_id
        self.content = content
        self.type = type
        self.created_at = created_at or datetime.now()
        self.completed = completed


class MockSimulationChatGrade:
    def __init__(self, id, score, passed, time_taken=300):
        self.id = id
        self.score = score
        self.passed = passed
        self.time_taken = time_taken
        self.created_at = datetime.now()


@patch("app.services.mcp.tools.analytics.student_sim_report.get_session")
class TestStudent_Sim_Report:
    """Tests for student_sim_report function."""

    def test_student_sim_report_success(self, mock_get_session):
        """Test successful student_sim_report execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Conflict Resolution")
        mock_scenario = MockScenario(scenario_id, "Test Scenario")
        
        base_time = datetime.now()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_attempt = MockSimulationAttempt(attempt_id, base_time, simulation_id, profile_id)
        mock_chat = MockSimulationChat(chat_id, attempt_id, scenario_id, base_time, base_time + timedelta(minutes=5), True)
        mock_grade = MockSimulationChatGrade(uuid.uuid4(), 85, True, 300)
        mock_message = MockSimulationMessage(uuid.uuid4(), chat_id, "Hello", "query")
        
        mock_session.get.side_effect = [mock_profile, mock_simulation, mock_scenario]
        mock_session.exec.return_value.all.side_effect = [[mock_attempt], [mock_chat], [mock_message], []]
        mock_session.exec.return_value.first.return_value = mock_grade
        
        result = student_sim_report(str(profile_id))
        
        assert result["profile"]["id"] == str(profile_id)
        assert result["profile"]["first_name"] == "John"
        assert result["profile"]["last_name"] == "Doe"
        assert result["profile"]["alias"] == "jdoe"
        assert "attempts" in result
        assert len(result["attempts"]) == 1

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
        assert result["attempts"] == []

    def test_student_sim_report_multiple_attempts(self, mock_get_session):
        """Test student_sim_report with multiple attempts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        mock_scenario = MockScenario(scenario_id, "Test Scenario")
        
        base_time = datetime.now()
        attempt1_id = uuid.uuid4()
        attempt2_id = uuid.uuid4()
        chat1_id = uuid.uuid4()
        chat2_id = uuid.uuid4()
        
        mock_attempt1 = MockSimulationAttempt(attempt1_id, base_time, simulation_id, profile_id)
        mock_attempt2 = MockSimulationAttempt(attempt2_id, base_time + timedelta(hours=1), simulation_id, profile_id)
        mock_chat1 = MockSimulationChat(chat1_id, attempt1_id, scenario_id)
        mock_chat2 = MockSimulationChat(chat2_id, attempt2_id, scenario_id)
        mock_message1 = MockSimulationMessage(uuid.uuid4(), chat1_id, "Hello", "query")
        mock_message2 = MockSimulationMessage(uuid.uuid4(), chat2_id, "Hi", "query")
        
        mock_session.get.side_effect = lambda model, id: {
            profile_id: mock_profile,
            simulation_id: mock_simulation,
            scenario_id: mock_scenario
        }.get(id)
        
        # Mock the nested query pattern: attempts -> chats -> messages -> grades
        mock_session.exec.return_value.all.side_effect = [
            [mock_attempt1, mock_attempt2],  # First call: get attempts
            [mock_chat1],                    # Second call: get chats for attempt1
            [mock_message1],                 # Third call: get messages for chat1
            [],                             # Fourth call: get feedback for chat1
            [mock_chat2],                    # Fifth call: get chats for attempt2
            [mock_message2],                 # Sixth call: get messages for chat2
            [],                             # Seventh call: get feedback for chat2
        ]
        mock_session.exec.return_value.first.return_value = None
        
        result = student_sim_report(str(profile_id))
        
        # The function returns one entry per chat, not per attempt
        assert len(result["attempts"]) == 2
        assert result["attempts"][0]["simulation_id"] == str(simulation_id)
        assert result["attempts"][1]["simulation_id"] == str(simulation_id)

    def test_student_sim_report_with_grades(self, mock_get_session):
        """Test student_sim_report with grade information."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        mock_scenario = MockScenario(scenario_id, "Test Scenario")
        
        base_time = datetime.now()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_attempt = MockSimulationAttempt(attempt_id, base_time, simulation_id, profile_id)
        mock_chat = MockSimulationChat(chat_id, attempt_id, scenario_id, base_time, base_time + timedelta(minutes=5), True)
        mock_grade = MockSimulationChatGrade(uuid.uuid4(), 90, True, 300)
        mock_message = MockSimulationMessage(uuid.uuid4(), chat_id, "Hello", "query")
        
        mock_session.get.side_effect = [mock_profile, mock_simulation, mock_scenario]
        mock_session.exec.return_value.all.side_effect = [[mock_attempt], [mock_chat], [mock_message], []]
        mock_session.exec.return_value.first.return_value = mock_grade
        
        result = student_sim_report(str(profile_id))
        
        assert len(result["attempts"]) == 1
        attempt = result["attempts"][0]
        assert attempt["chat"]["grade"]["score"] == 90
        assert attempt["chat"]["grade"]["passed"] is True
        assert attempt["chat"]["grade"]["time_taken"] == 300

    def test_student_sim_report_no_grade(self, mock_get_session):
        """Test student_sim_report with attempt but no grade."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        mock_scenario = MockScenario(scenario_id, "Test Scenario")
        
        base_time = datetime.now()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()
        
        mock_attempt = MockSimulationAttempt(attempt_id, base_time, simulation_id, profile_id)
        mock_chat = MockSimulationChat(chat_id, attempt_id, scenario_id, base_time, base_time + timedelta(minutes=5), True)
        
        mock_session.get.side_effect = [mock_profile, mock_simulation, mock_scenario]
        mock_session.exec.return_value.all.side_effect = [[mock_attempt], [mock_chat], []]
        mock_session.exec.return_value.first.return_value = None  # No grade
        
        result = student_sim_report(str(profile_id))
        
        assert len(result["attempts"]) == 1
        attempt = result["attempts"][0]
        assert attempt["chat"]["grade"] == {}

    def test_student_sim_report_multiple_simulations(self, mock_get_session):
        """Test student_sim_report with multiple simulations."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        profile_id = uuid.uuid4()
        simulation1_id = uuid.uuid4()
        simulation2_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation1 = MockSimulation(simulation1_id, "Simulation 1")
        mock_simulation2 = MockSimulation(simulation2_id, "Simulation 2")
        mock_scenario = MockScenario(scenario_id, "Test Scenario")
        
        base_time = datetime.now()
        attempt1_id = uuid.uuid4()
        attempt2_id = uuid.uuid4()
        chat1_id = uuid.uuid4()
        chat2_id = uuid.uuid4()
        
        mock_attempt1 = MockSimulationAttempt(attempt1_id, base_time, simulation1_id, profile_id)
        mock_attempt2 = MockSimulationAttempt(attempt2_id, base_time + timedelta(hours=1), simulation2_id, profile_id)
        mock_chat1 = MockSimulationChat(chat1_id, attempt1_id, scenario_id)
        mock_chat2 = MockSimulationChat(chat2_id, attempt2_id, scenario_id)
        mock_message1 = MockSimulationMessage(uuid.uuid4(), chat1_id, "Hello", "query")
        mock_message2 = MockSimulationMessage(uuid.uuid4(), chat2_id, "Hi", "query")
        
        mock_session.get.side_effect = lambda model, id: {
            profile_id: mock_profile,
            simulation1_id: mock_simulation1,
            simulation2_id: mock_simulation2,
            scenario_id: mock_scenario
        }.get(id)
        
        # Mock the nested query pattern: attempts -> chats -> messages -> grades
        mock_session.exec.return_value.all.side_effect = [
            [mock_attempt1, mock_attempt2],  # First call: get attempts
            [mock_chat1],                    # Second call: get chats for attempt1
            [mock_message1],                 # Third call: get messages for chat1
            [],                             # Fourth call: get feedback for chat1
            [mock_chat2],                    # Fifth call: get chats for attempt2
            [mock_message2],                 # Sixth call: get messages for chat2
            [],                             # Seventh call: get feedback for chat2
        ]
        mock_session.exec.return_value.first.return_value = None
        
        result = student_sim_report(str(profile_id))
        
        # The function returns one entry per chat, not per attempt
        assert len(result["attempts"]) == 2
        simulation_ids = [attempt["simulation_id"] for attempt in result["attempts"]]
        assert str(simulation1_id) in simulation_ids
        assert str(simulation2_id) in simulation_ids

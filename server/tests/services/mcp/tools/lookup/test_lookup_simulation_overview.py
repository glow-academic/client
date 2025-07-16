"""
Tests for app.services.mcp.tools.lookup.simulation_overview
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.lookup.simulation_overview import \
    simulation_overview
from sqlalchemy.exc import SQLAlchemyError


class MockSimulation:
    def __init__(self, id, title, active=True, time_limit=30, rubric_id=None, cohort_ids=None, scenario_ids=None):
        self.id = id
        self.title = title
        self.active = active
        self.time_limit = time_limit
        self.rubric_id = rubric_id or uuid.uuid4()
        self.cohort_ids = cohort_ids or []
        self.scenario_ids = scenario_ids or []
        self.created_at = datetime.now()


class MockRubric:
    def __init__(self, id, name, desc, points=100, pass_points=70):
        self.id = id
        self.name = name
        self.description = desc
        self.points = points
        self.pass_points = pass_points


class MockCohort:
    def __init__(self, id, title, desc="", active=True, profile_ids=None):
        self.id = id
        self.title = title
        self.description = desc
        self.active = active
        self.profile_ids = profile_ids or []
        self.created_at = datetime.now()


class MockScenario:
    def __init__(self, id, name, desc, default=False, agent_id=None, class_id=None):
        self.id = id
        self.name = name
        self.description = desc
        self.default_scenario = default
        self.agent_id = agent_id
        self.class_id = class_id
        self.created_at = datetime.now()
        self.updated_at = datetime.now()


class MockAttempt:
    def __init__(self, id, sim_id):
        self.id = id
        self.simulation_id = sim_id
        self.created_at = datetime.now()


class MockChat:
    def __init__(self, id, attempt_id):
        self.id = id
        self.attempt_id = attempt_id
        self.created_at = datetime.now()


class MockGrade:
    def __init__(self, chat_id, score, passed):
        self.simulation_chat_id = chat_id
        self.score = score
        self.passed = passed
        self.time_taken = 120
        self.created_at = datetime.now()


@patch("app.services.mcp.tools.lookup.simulation_overview.get_session")
class TestSimulationOverview:
    """Tests for simulation_overview function."""

    def test_simulation_overview_success(self, mock_get_session):
        """Test successful simulation_overview execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim", rubric_id=rubric_id)
        mock_rubric = MockRubric(rubric_id, "Test Rubric", "Desc")
        mock_attempt = MockAttempt(uuid.uuid4(), sim_id)
        mock_chat = MockChat(uuid.uuid4(), mock_attempt.id)
        mock_grade = MockGrade(mock_chat.id, 90, True)

        mock_session.get.side_effect = [mock_sim, mock_rubric]
        # Mock session.exec calls: attempts, chats (cohorts and scenarios calls are skipped since arrays are empty)
        mock_session.exec.return_value.all.side_effect = [
            [mock_attempt],  # attempts
            [mock_chat],  # chats
        ]
        mock_session.exec.return_value.first.side_effect = [mock_grade]
        
        result = simulation_overview(str(sim_id))
        
        assert result["simulation"]["id"] == str(sim_id)
        assert result["simulation"]["title"] == "Test Sim"
        assert result["simulation"]["active"] is True
        assert result["simulation"]["time_limit"] == 30
        assert result["rubric"]["name"] == "Test Rubric"
        assert result["rubric"]["description"] == "Desc"
        assert result["rubric"]["points"] == 100
        assert result["rubric"]["pass_points"] == 70
        assert result["cohorts"] == []
        assert result["scenarios"] == []
        assert result["stats"]["total_attempts"] == 1
        assert result["stats"]["total_graded"] == 1
        assert result["stats"]["pass_rate"] == 100.0

    def test_simulation_overview_not_found(self, mock_get_session):
        """Test simulation_overview when simulation is not found."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.get.return_value = None
        
        result = simulation_overview(str(uuid.uuid4()))
        
        assert "error" in result
        assert "not found" in result["error"]

    def test_simulation_overview_invalid_uuid(self, mock_get_session):
        """Test simulation_overview with invalid UUID format."""
        result = simulation_overview("invalid-uuid")
        
        assert "error" in result
        assert "Invalid sim_id format" in result["error"]

    def test_simulation_overview_database_error(self, mock_get_session):
        """Test simulation_overview database error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")
        
        result = simulation_overview(str(uuid.uuid4()))
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_simulation_overview_no_rubric(self, mock_get_session):
        """Test simulation_overview when simulation has no rubric."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim", rubric_id=None)
        
        # When rubric_id is None, session.get for rubric should return None
        mock_session.get.side_effect = [mock_sim, None]  # simulation, rubric
        # No exec calls are made since all arrays are empty
        mock_session.exec.return_value.all.return_value = []
        
        result = simulation_overview(str(sim_id))
        
        assert result["rubric"] == {}

    def test_simulation_overview_with_cohorts(self, mock_get_session):
        """Test simulation_overview with associated cohorts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        cohort_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim", cohort_ids=[cohort_id])
        mock_cohort = MockCohort(cohort_id, "Test Cohort")
        
        # When rubric_id is not None, session.get for rubric should return None (no rubric)
        mock_session.get.side_effect = [mock_sim, None]  # simulation, rubric
        mock_session.exec.return_value.all.side_effect = [
            [mock_cohort],  # cohorts
            [],  # scenarios
            [],  # attempts
        ]
        
        result = simulation_overview(str(sim_id))
        
        assert len(result["cohorts"]) == 1
        assert result["cohorts"][0]["id"] == str(cohort_id)
        assert result["cohorts"][0]["title"] == "Test Cohort"
        assert result["cohorts"][0]["active"] is True

    def test_simulation_overview_with_scenarios(self, mock_get_session):
        """Test simulation_overview with associated scenarios."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        scenario_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim", scenario_ids=[scenario_id])
        mock_scenario = MockScenario(scenario_id, "Test Scenario", "Desc")
        
        # When rubric_id is not None, session.get for rubric should return None (no rubric)
        mock_session.get.side_effect = [mock_sim, None]  # simulation, rubric
        # Mock session.exec calls: scenarios, attempts (cohorts call is skipped since cohort_ids is empty)
        mock_session.exec.return_value.all.side_effect = [
            [mock_scenario],  # scenarios
            [],  # attempts
        ]
        
        result = simulation_overview(str(sim_id))
        
        assert len(result["scenarios"]) == 1
        assert result["scenarios"][0]["id"] == str(scenario_id)
        assert result["scenarios"][0]["name"] == "Test Scenario"
        assert result["scenarios"][0]["description"] == "Desc"

    def test_simulation_overview_pass_rate_calculation(self, mock_get_session):
        """Test simulation_overview pass rate calculation."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim")
        
        # Create attempts with different outcomes
        mock_attempts = [
            MockAttempt(uuid.uuid4(), sim_id),
            MockAttempt(uuid.uuid4(), sim_id),
            MockAttempt(uuid.uuid4(), sim_id),
        ]
        
        mock_chats = [
            MockChat(uuid.uuid4(), mock_attempts[0].id),
            MockChat(uuid.uuid4(), mock_attempts[1].id),
            MockChat(uuid.uuid4(), mock_attempts[2].id),
        ]
        
        # 2 passed, 1 failed
        mock_grades = [
            MockGrade(mock_chats[0].id, 85, True),   # Passed
            MockGrade(mock_chats[1].id, 65, False),  # Failed
            MockGrade(mock_chats[2].id, 90, True),   # Passed
        ]
        
        # When rubric_id is not None, session.get for rubric should return None (no rubric)
        mock_session.get.side_effect = [mock_sim, None]  # simulation, rubric
        # Mock session.exec calls: attempts, then for each attempt: chats, then for each chat: grade
        mock_session.exec.return_value.all.side_effect = [
            mock_attempts,  # attempts
            [mock_chats[0]],  # chats for attempt 1
            [mock_chats[1]],  # chats for attempt 2
            [mock_chats[2]],  # chats for attempt 3
        ]
        mock_session.exec.return_value.first.side_effect = mock_grades
        
        result = simulation_overview(str(sim_id))
        
        assert result["stats"]["total_attempts"] == 3
        assert result["stats"]["total_graded"] == 3
        assert result["stats"]["pass_rate"] == 66.67  # 2/3 * 100

    def test_simulation_overview_no_grades(self, mock_get_session):
        """Test simulation_overview when no grades exist."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim")
        mock_attempt = MockAttempt(uuid.uuid4(), sim_id)
        mock_chat = MockChat(uuid.uuid4(), mock_attempt.id)
        
        # When rubric_id is not None, session.get for rubric should return None (no rubric)
        mock_session.get.side_effect = [mock_sim, None]  # simulation, rubric
        # Mock session.exec calls: attempts, chats (cohorts and scenarios calls are skipped since arrays are empty)
        mock_session.exec.return_value.all.side_effect = [
            [mock_attempt],  # attempts
            [mock_chat],  # chats
        ]
        mock_session.exec.return_value.first.side_effect = [None]  # No grade
        
        result = simulation_overview(str(sim_id))
        
        assert result["stats"]["total_attempts"] == 1
        assert result["stats"]["total_graded"] == 0
        assert result["stats"]["pass_rate"] == 0

    def test_simulation_overview_multiple_chats_per_attempt(self, mock_get_session):
        """Test simulation_overview with multiple chats per attempt."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim")
        mock_attempt = MockAttempt(uuid.uuid4(), sim_id)
        
        # Multiple chats for the same attempt
        mock_chats = [
            MockChat(uuid.uuid4(), mock_attempt.id),
            MockChat(uuid.uuid4(), mock_attempt.id),
            MockChat(uuid.uuid4(), mock_attempt.id),
        ]
        
        # Only one chat has a grade
        mock_grade = MockGrade(mock_chats[0].id, 85, True)
        
        # When rubric_id is not None, session.get for rubric should return None (no rubric)
        mock_session.get.side_effect = [mock_sim, None]  # simulation, rubric
        # Mock session.exec calls: attempts, chats (cohorts and scenarios calls are skipped since arrays are empty)
        mock_session.exec.return_value.all.side_effect = [
            [mock_attempt],  # attempts
            mock_chats,  # chats
        ]
        mock_session.exec.return_value.first.side_effect = [mock_grade, None, None]
        
        result = simulation_overview(str(sim_id))
        
        assert result["stats"]["total_attempts"] == 1
        assert result["stats"]["total_graded"] == 1
        assert result["stats"]["pass_rate"] == 100.0

    def test_simulation_overview_null_timestamps(self, mock_get_session):
        """Test simulation_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim")
        mock_sim.created_at = None
        
        # When rubric_id is not None, session.get for rubric should return None (no rubric)
        mock_session.get.side_effect = [mock_sim, None]  # simulation, rubric
        # No exec calls are made since all arrays are empty
        mock_session.exec.return_value.all.return_value = []
        
        result = simulation_overview(str(sim_id))
        
        assert result["simulation"]["created_at"] is None

    def test_simulation_overview_complex_stats(self, mock_get_session):
        """Test simulation_overview with complex statistics."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        sim_id = uuid.uuid4()
        
        mock_sim = MockSimulation(sim_id, "Test Sim")
        
        # Create 10 attempts, 8 with grades, 6 passed
        mock_attempts = [MockAttempt(uuid.uuid4(), sim_id) for _ in range(10)]
        mock_chats = [MockChat(uuid.uuid4(), attempt.id) for attempt in mock_attempts]
        
        # 6 passed, 2 failed, 2 no grades
        mock_grades = []
        for i in range(8):  # Only 8 have grades
            passed = i < 6  # First 6 passed
            mock_grades.append(MockGrade(mock_chats[i].id, 85 if passed else 65, passed))
        
        # When rubric_id is not None, session.get for rubric should return None (no rubric)
        mock_session.get.side_effect = [mock_sim, None]  # simulation, rubric
        # Mock session.exec calls: attempts, then for each attempt: chats, then for each chat: grade
        mock_session.exec.return_value.all.side_effect = [
            mock_attempts,  # attempts
        ] + [[chat] for chat in mock_chats]  # chats for each attempt
        mock_session.exec.return_value.first.side_effect = mock_grades + [None, None]  # 8 grades + 2 None
        
        result = simulation_overview(str(sim_id))
        
        assert result["stats"]["total_attempts"] == 10
        assert result["stats"]["total_graded"] == 8
        assert result["stats"]["pass_rate"] == 75.0  # 6/8 * 100



import pytest


@pytest.mark.skip(reason="TODO: implement tests for `simulation_overview`")
class TestSimulation_Overview:
    """Tests for simulation_overview function."""

    def test_simulation_overview_success(self):
        """Test successful simulation_overview execution."""
        # TODO: Implement test for simulation_overview
        assert False, "IMPLEMENT: Test for simulation_overview"

    def test_simulation_overview_error(self):
        """Test simulation_overview error handling."""
        # TODO: Implement error test for simulation_overview
        assert False, "IMPLEMENT: Error test for simulation_overview"


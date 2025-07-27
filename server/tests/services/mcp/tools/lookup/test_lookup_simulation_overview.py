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
    def __init__(self, id, title, active=True, time_limit=30, rubric_id=None):
        self.id = id
        self.title = title
        self.active = active
        self.time_limit = time_limit
        self.rubric_id = rubric_id or uuid.uuid4()
        self.created_at = datetime.now()
        self.updated_at = datetime.now()


class MockRubric:
    def __init__(self, id, name, points, pass_points):
        self.id = id
        self.name = name
        self.points = points
        self.pass_points = pass_points


class MockSimulationChatGrade:
    def __init__(self, id, score, passed, time_taken):
        self.id = id
        self.score = score
        self.passed = passed
        self.time_taken = time_taken


@patch("app.services.mcp.tools.lookup.simulation_overview.get_session")
class TestSimulation_Overview:
    """Tests for simulation_overview function."""

    def test_simulation_overview_success(self, mock_get_session):
        """Test successful simulation_overview execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_simulation = MockSimulation(simulation_id, "Conflict Resolution", True, 30, rubric_id)
        mock_rubric = MockRubric(rubric_id, "Communication Skills", 100, 70)
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_rubric
        mock_session.exec.return_value.all.return_value = []
        
        result = simulation_overview(str(simulation_id))
        
        assert result["simulation"]["id"] == str(simulation_id)
        assert result["simulation"]["title"] == "Conflict Resolution"
        assert result["simulation"]["active"] is True
        assert result["simulation"]["time_limit"] == 30
        assert result["rubric"]["id"] == str(rubric_id)
        assert result["rubric"]["name"] == "Communication Skills"
        assert result["rubric"]["points"] == 100
        assert result["rubric"]["pass_points"] == 70
        assert result["cohorts"] == []
        assert result["scenarios"] == []

    def test_simulation_overview_error(self, mock_get_session):
        """Test simulation_overview error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")
        
        result = simulation_overview(str(simulation_id))
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_simulation_overview_simulation_not_found(self, mock_get_session):
        """Test simulation_overview with non-existent simulation."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        mock_session.get.return_value = None
        
        result = simulation_overview(str(simulation_id))
        
        assert "error" in result
        assert "Simulation not found" in result["error"]

    def test_simulation_overview_invalid_uuid(self, mock_get_session):
        """Test simulation_overview with invalid UUID."""
        result = simulation_overview("invalid-uuid")
        
        assert "error" in result
        assert "Invalid sim_id format" in result["error"]

    def test_simulation_overview_no_rubric(self, mock_get_session):
        """Test simulation_overview with no associated rubric."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = None  # No rubric
        mock_session.exec.return_value.all.return_value = []
        
        result = simulation_overview(str(simulation_id))
        
        assert result["simulation"]["id"] == str(simulation_id)
        assert result["rubric"] is None
        assert result["cohorts"] == []
        assert result["scenarios"] == []

    def test_simulation_overview_with_cohorts(self, mock_get_session):
        """Test simulation_overview with associated cohorts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", rubric_id=rubric_id)
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        
        # Mock cohort data
        cohort_data = [
            {"id": str(uuid.uuid4()), "title": "Cohort 1", "student_count": 15},
            {"id": str(uuid.uuid4()), "title": "Cohort 2", "student_count": 20},
        ]
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_rubric
        mock_session.exec.return_value.all.return_value = cohort_data
        
        result = simulation_overview(str(simulation_id))
        
        assert len(result["cohorts"]) == 2
        assert result["cohorts"][0]["title"] == "Cohort 1"
        assert result["cohorts"][0]["student_count"] == 15
        assert result["cohorts"][1]["title"] == "Cohort 2"
        assert result["cohorts"][1]["student_count"] == 20

    def test_simulation_overview_with_scenarios(self, mock_get_session):
        """Test simulation_overview with associated scenarios."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", rubric_id=rubric_id)
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        
        # Mock scenario data
        scenario_data = [
            {"id": str(uuid.uuid4()), "name": "Scenario 1", "description": "First scenario"},
            {"id": str(uuid.uuid4()), "name": "Scenario 2", "description": "Second scenario"},
        ]
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_rubric
        mock_session.exec.return_value.all.return_value = scenario_data
        
        result = simulation_overview(str(simulation_id))
        
        assert len(result["scenarios"]) == 2
        assert result["scenarios"][0]["name"] == "Scenario 1"
        assert result["scenarios"][1]["name"] == "Scenario 2"

    def test_simulation_overview_pass_rate_calculation(self, mock_get_session):
        """Test simulation_overview pass rate calculation."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", rubric_id=rubric_id)
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        
        # Mock grade data for pass rate calculation
        grade_data = [
            MockSimulationChatGrade(uuid.uuid4(), 85, True, 300),
            MockSimulationChatGrade(uuid.uuid4(), 65, False, 400),
            MockSimulationChatGrade(uuid.uuid4(), 90, True, 250),
        ]
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_rubric
        mock_session.exec.return_value.all.return_value = grade_data
        
        result = simulation_overview(str(simulation_id))
        
        # 2 out of 3 passed = 66.67% pass rate
        assert result["pass_rate"] == 66.67
        assert result["total_attempts"] == 3
        assert result["passed_attempts"] == 2

    def test_simulation_overview_no_grades(self, mock_get_session):
        """Test simulation_overview with no grades."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", rubric_id=rubric_id)
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_rubric
        mock_session.exec.return_value.all.return_value = []
        
        result = simulation_overview(str(simulation_id))
        
        assert result["pass_rate"] == 0
        assert result["total_attempts"] == 0
        assert result["passed_attempts"] == 0

    def test_simulation_overview_multiple_chats_per_attempt(self, mock_get_session):
        """Test simulation_overview with multiple chats per attempt."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", rubric_id=rubric_id)
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        
        # Mock grade data with multiple chats per attempt
        grade_data = [
            MockSimulationChatGrade(uuid.uuid4(), 85, True, 300),
            MockSimulationChatGrade(uuid.uuid4(), 75, True, 350),  # Same attempt, different chat
            MockSimulationChatGrade(uuid.uuid4(), 65, False, 400),
        ]
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_rubric
        mock_session.exec.return_value.all.return_value = grade_data
        
        result = simulation_overview(str(simulation_id))
        
        # Should handle multiple chats per attempt correctly
        assert result["total_attempts"] == 3
        assert result["passed_attempts"] == 2

    def test_simulation_overview_null_timestamps(self, mock_get_session):
        """Test simulation_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", rubric_id=rubric_id)
        mock_simulation.created_at = None
        mock_simulation.updated_at = None
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_rubric
        mock_session.exec.return_value.all.return_value = []
        
        result = simulation_overview(str(simulation_id))
        
        assert result["simulation"]["created_at"] is None
        assert result["simulation"]["updated_at"] is None

    def test_simulation_overview_complex_stats(self, mock_get_session):
        """Test simulation_overview with complex statistics."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        
        mock_simulation = MockSimulation(simulation_id, "Complex Simulation", True, 45, rubric_id)
        mock_rubric = MockRubric(rubric_id, "Complex Rubric", 150, 105)
        
        # Mock complex grade data
        grade_data = [
            MockSimulationChatGrade(uuid.uuid4(), 95, True, 200),
            MockSimulationChatGrade(uuid.uuid4(), 88, True, 300),
            MockSimulationChatGrade(uuid.uuid4(), 72, False, 450),
            MockSimulationChatGrade(uuid.uuid4(), 91, True, 280),
            MockSimulationChatGrade(uuid.uuid4(), 68, False, 500),
        ]
        
        mock_session.get.return_value = mock_simulation
        mock_session.exec.return_value.first.return_value = mock_rubric
        mock_session.exec.return_value.all.return_value = grade_data
        
        result = simulation_overview(str(simulation_id))
        
        assert result["total_attempts"] == 5
        assert result["passed_attempts"] == 3
        assert result["pass_rate"] == 60.0
        assert result["average_score"] == 82.8  # (95+88+72+91+68)/5
        assert result["average_time_taken"] == 346  # (200+300+450+280+500)/5

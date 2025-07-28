"""
Tests for app.services.mcp.tools.lookup.simulation_overview
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.services.mcp.tools.lookup.simulation_overview import \
    simulation_overview
from sqlalchemy.exc import SQLAlchemyError


class MockSimulation:
    def __init__(
        self, id, title, active=True, time_limit=30, rubric_id=None, scenario_ids=None
    ):
        self.id = id
        self.title = title
        self.active = active
        self.time_limit = time_limit
        self.rubric_id = rubric_id or uuid.uuid4()
        self.scenario_ids = scenario_ids or []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()


class MockRubric:
    def __init__(self, id, name, points, pass_points, description=""):
        self.id = id
        self.name = name
        self.points = points
        self.pass_points = pass_points
        self.description = description


class MockCohort:
    def __init__(self, id, title, active=True, simulation_ids=None):
        self.id = id
        self.title = title
        self.active = active
        self.simulation_ids = simulation_ids or []


class MockScenario:
    def __init__(self, id, name, description=""):
        self.id = id
        self.name = name
        self.description = description


class MockSimulationAttempt:
    def __init__(self, id, simulation_id, profile_id=None):
        self.id = id
        self.simulation_id = simulation_id
        self.profile_id = profile_id or uuid.uuid4()


class MockSimulationChat:
    def __init__(self, id, attempt_id):
        self.id = id
        self.attempt_id = attempt_id


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

        mock_simulation = MockSimulation(
            simulation_id, "Conflict Resolution", True, 30, rubric_id
        )
        mock_rubric = MockRubric(rubric_id, "Communication Skills", 100, 70)

        # Set up side_effect to return different objects for different session.get() calls
        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation,
            rubric_id: mock_rubric,
        }.get(id)

        mock_session.exec.return_value.all.return_value = []
        mock_session.exec.return_value.first.return_value = None

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

        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation
        }.get(id)
        mock_session.exec.return_value.all.return_value = []

        result = simulation_overview(str(simulation_id))

        assert result["simulation"]["id"] == str(simulation_id)
        assert result["rubric"] == {}
        assert result["cohorts"] == []
        assert result["scenarios"] == []

    def test_simulation_overview_with_cohorts(self, mock_get_session):
        """Test simulation_overview with associated cohorts."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        cohort_id = uuid.uuid4()

        mock_simulation = MockSimulation(
            simulation_id, "Test Simulation", rubric_id=rubric_id
        )
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        mock_cohort = MockCohort(
            cohort_id, "Test Cohort", simulation_ids=[simulation_id]
        )

        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation,
            rubric_id: mock_rubric,
        }.get(id)
        mock_session.exec.return_value.all.return_value = [mock_cohort]

        result = simulation_overview(str(simulation_id))

        assert result["simulation"]["id"] == str(simulation_id)
        assert result["rubric"]["id"] == str(rubric_id)
        assert len(result["cohorts"]) == 1
        assert result["cohorts"][0]["id"] == str(cohort_id)
        assert result["cohorts"][0]["title"] == "Test Cohort"

    def test_simulation_overview_with_scenarios(self, mock_get_session):
        """Test simulation_overview with associated scenarios."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        scenario_id = uuid.uuid4()

        mock_simulation = MockSimulation(
            simulation_id,
            "Test Simulation",
            rubric_id=rubric_id,
            scenario_ids=[scenario_id],
        )
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        mock_scenario = MockScenario(scenario_id, "Test Scenario", "A test scenario")

        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation,
            rubric_id: mock_rubric,
        }.get(id)
        mock_session.exec.return_value.all.return_value = [mock_scenario]

        result = simulation_overview(str(simulation_id))

        assert result["simulation"]["id"] == str(simulation_id)
        assert result["rubric"]["id"] == str(rubric_id)
        assert len(result["scenarios"]) == 1
        assert result["scenarios"][0]["id"] == str(scenario_id)
        assert result["scenarios"][0]["name"] == "Test Scenario"

    def test_simulation_overview_pass_rate_calculation(self, mock_get_session):
        """Test simulation_overview pass rate calculation."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        attempt_id = uuid.uuid4()
        chat_id = uuid.uuid4()

        mock_simulation = MockSimulation(
            simulation_id, "Test Simulation", rubric_id=rubric_id
        )
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        mock_attempt = MockSimulationAttempt(attempt_id, simulation_id)
        mock_chat = MockSimulationChat(chat_id, attempt_id)
        mock_grade = MockSimulationChatGrade(uuid.uuid4(), 85, True, 300)

        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation,
            rubric_id: mock_rubric,
        }.get(id)

        # Custom exec mock to handle .all() and .first() for each call, using a call counter
        def exec_side_effect(stmt, *args, **kwargs):
            m = MagicMock()
            if not hasattr(exec_side_effect, "call_count"):
                exec_side_effect.call_count = 0
            call = exec_side_effect.call_count
            exec_side_effect.call_count += 1

            # The order of calls is:
            # 0: cohorts (select Cohorts)
            # 1: attempts (select SimulationAttempts)
            # 2: chats for attempt (select SimulationChats)
            # 3: grade for chat (select SimulationChatGrades)
            if call == 0:  # cohorts
                m.all.return_value = []
                m.first.return_value = None
            elif call == 1:  # attempts
                m.all.return_value = [mock_attempt]
                m.first.return_value = None
            elif call == 2:  # chats
                m.all.return_value = [mock_chat]
                m.first.return_value = None
            elif call == 3:  # grades
                m.all.return_value = []
                m.first.return_value = mock_grade
            else:
                m.all.return_value = []
                m.first.return_value = None
            return m

        exec_side_effect.call_count = 0
        mock_session.exec.side_effect = exec_side_effect

        result = simulation_overview(str(simulation_id))
        assert result["simulation"]["id"] == str(simulation_id)
        assert result["stats"]["total_attempts"] == 1

    def test_simulation_overview_no_grades(self, mock_get_session):
        """Test simulation_overview with no grades."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()

        mock_simulation = MockSimulation(
            simulation_id, "Test Simulation", rubric_id=rubric_id
        )
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)

        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation,
            rubric_id: mock_rubric,
        }.get(id)
        mock_session.exec.return_value.all.return_value = []

        result = simulation_overview(str(simulation_id))

        assert result["simulation"]["id"] == str(simulation_id)
        assert result["stats"]["total_attempts"] == 0
        assert result["stats"]["total_graded"] == 0
        assert result["stats"]["pass_rate"] == 0

    def test_simulation_overview_multiple_chats_per_attempt(self, mock_get_session):
        """Test simulation_overview with multiple chats per attempt."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        attempt_id = uuid.uuid4()
        chat1_id = uuid.uuid4()
        chat2_id = uuid.uuid4()

        mock_simulation = MockSimulation(
            simulation_id, "Test Simulation", rubric_id=rubric_id
        )
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        mock_attempt = MockSimulationAttempt(attempt_id, simulation_id)
        mock_chat1 = MockSimulationChat(chat1_id, attempt_id)
        mock_chat2 = MockSimulationChat(chat2_id, attempt_id)
        mock_grade1 = MockSimulationChatGrade(uuid.uuid4(), 85, True, 300)
        mock_grade2 = MockSimulationChatGrade(uuid.uuid4(), 75, True, 350)

        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation,
            rubric_id: mock_rubric,
        }.get(id)

        # Custom exec mock to handle .all() and .first() for each call, using a call counter
        def exec_side_effect(stmt, *args, **kwargs):
            m = MagicMock()
            if not hasattr(exec_side_effect, "call_count"):
                exec_side_effect.call_count = 0
            call = exec_side_effect.call_count
            exec_side_effect.call_count += 1
            # 0: attempts, 1: chats, 2: grade1, 3: grade2
            if call == 0:  # attempts
                m.all.return_value = [mock_attempt]
            elif call == 1:  # chats
                m.all.return_value = [mock_chat1, mock_chat2]
            elif call == 2:  # grade1
                m.first.return_value = mock_grade1
            elif call == 3:  # grade2
                m.first.return_value = mock_grade2
            else:
                m.all.return_value = []
                m.first.return_value = None
            return m

        exec_side_effect.call_count = 0
        mock_session.exec.side_effect = exec_side_effect

    def test_simulation_overview_null_timestamps(self, mock_get_session):
        """Test simulation_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()

        mock_simulation = MockSimulation(
            simulation_id, "Test Simulation", rubric_id=rubric_id
        )
        mock_simulation.created_at = None
        mock_simulation.updated_at = None
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)

        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation,
            rubric_id: mock_rubric,
        }.get(id)
        mock_session.exec.return_value.all.return_value = []

        result = simulation_overview(str(simulation_id))

        assert result["simulation"]["id"] == str(simulation_id)
        assert result["simulation"]["created_at"] is None
        assert result["rubric"]["id"] == str(rubric_id)

    def test_simulation_overview_complex_stats(self, mock_get_session):
        """Test simulation_overview with complex statistics."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        attempt1_id = uuid.uuid4()
        attempt2_id = uuid.uuid4()
        chat1_id = uuid.uuid4()
        chat2_id = uuid.uuid4()

        mock_simulation = MockSimulation(
            simulation_id, "Complex Simulation", True, 45, rubric_id
        )
        mock_rubric = MockRubric(rubric_id, "Complex Rubric", 150, 105)
        mock_attempt1 = MockSimulationAttempt(attempt1_id, simulation_id)
        mock_attempt2 = MockSimulationAttempt(attempt2_id, simulation_id)
        mock_chat1 = MockSimulationChat(chat1_id, attempt1_id)
        mock_chat2 = MockSimulationChat(chat2_id, attempt2_id)
        mock_grade1 = MockSimulationChatGrade(uuid.uuid4(), 95, True, 200)
        mock_grade2 = MockSimulationChatGrade(uuid.uuid4(), 72, False, 450)

        mock_session.get.side_effect = lambda model, id: {
            simulation_id: mock_simulation,
            rubric_id: mock_rubric,
        }.get(id)

        # Custom exec mock to handle .all() and .first() for each call, using a call counter
        def exec_side_effect(stmt, *args, **kwargs):
            m = MagicMock()
            if not hasattr(exec_side_effect, "call_count"):
                exec_side_effect.call_count = 0
            call = exec_side_effect.call_count
            exec_side_effect.call_count += 1
            # 0: attempts, 1: chats1, 2: grade1, 3: chats2, 4: grade2
            if call == 0:  # attempts
                m.all.return_value = [mock_attempt1, mock_attempt2]
            elif call == 1:  # chats1
                m.all.return_value = [mock_chat1]
            elif call == 2:  # grade1
                m.first.return_value = mock_grade1
            elif call == 3:  # chats2
                m.all.return_value = [mock_chat2]
            elif call == 4:  # grade2
                m.first.return_value = mock_grade2
            else:
                m.all.return_value = []
                m.first.return_value = None
            return m

        exec_side_effect.call_count = 0
        mock_session.exec.side_effect = exec_side_effect

"""
Tests for app.mcp.tools.lookup.cohort_overview
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.mcp.tools.lookup.cohort_overview import cohort_overview
from sqlalchemy.exc import SQLAlchemyError


class MockCohort:
    def __init__(
        self,
        id,
        title,
        description="",
        active=True,
        profile_ids=None,
        simulation_ids=None,
    ):
        self.id = id
        self.title = title
        self.description = description
        self.active = active
        self.profile_ids = profile_ids or []
        self.simulation_ids = simulation_ids or []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()


class MockProfile:
    def __init__(self, id, first_name, last_name, alias, role="student"):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.alias = alias
        self.role = role
        self.last_login = datetime.now()
        self.created_at = datetime.now()
        self.active = True


class MockSimulation:
    def __init__(self, id, title, active=True, time_limit=30):
        self.id = id
        self.title = title
        self.active = active
        self.time_limit = time_limit
        self.created_at = datetime.now()


@patch("app.mcp.tools.lookup.cohort_overview.get_session")
class TestCohort_Overview:
    """Tests for cohort_overview function."""

    def test_cohort_overview_success(self, mock_get_session):
        """Test successful cohort_overview execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()

        mock_cohort = MockCohort(
            cohort_id,
            "Test Cohort",
            "A test cohort for students",
            profile_ids=[profile_id],
            simulation_ids=[simulation_id],
        )
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")

        mock_session.get.return_value = mock_cohort
        mock_session.exec.return_value.all.side_effect = [
            [mock_profile],
            [mock_simulation],
        ]

        result = cohort_overview(str(cohort_id))

        assert result["cohort"]["id"] == str(cohort_id)
        assert result["cohort"]["title"] == "Test Cohort"
        assert result["cohort"]["description"] == "A test cohort for students"
        assert result["cohort"]["active"] is True
        assert len(result["roster"]) == 1
        assert result["roster"][0]["id"] == str(profile_id)
        assert result["roster"][0]["first_name"] == "John"
        assert result["roster"][0]["last_name"] == "Doe"
        assert len(result["simulations"]) == 1
        assert result["simulations"][0]["id"] == str(simulation_id)
        assert result["simulations"][0]["title"] == "Test Simulation"

    def test_cohort_overview_error(self, mock_get_session):
        """Test cohort_overview error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")

        result = cohort_overview(str(cohort_id))

        assert "error" in result
        assert "Database error" in result["error"]

    def test_cohort_overview_cohort_not_found(self, mock_get_session):
        """Test cohort_overview with non-existent cohort."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        mock_session.get.return_value = None

        result = cohort_overview(str(cohort_id))

        assert "error" in result
        assert "Cohort not found" in result["error"]

    def test_cohort_overview_invalid_uuid(self, mock_get_session):
        """Test cohort_overview with invalid UUID."""
        result = cohort_overview("invalid-uuid")

        assert "error" in result
        assert "Invalid cohort_id format" in result["error"]

    def test_cohort_overview_empty_roster(self, mock_get_session):
        """Test cohort_overview with empty roster."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        mock_cohort = MockCohort(cohort_id, "Empty Cohort", profile_ids=[])

        mock_session.get.return_value = mock_cohort
        mock_session.exec.return_value.all.return_value = []

        result = cohort_overview(str(cohort_id))

        assert result["cohort"]["id"] == str(cohort_id)
        assert result["roster"] == []
        assert result["stats"]["total_students"] == 0

    def test_cohort_overview_multiple_students(self, mock_get_session):
        """Test cohort_overview with multiple students."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        profile1_id = uuid.uuid4()
        profile2_id = uuid.uuid4()
        simulation_id = uuid.uuid4()

        mock_cohort = MockCohort(
            cohort_id,
            "Multi Student Cohort",
            profile_ids=[profile1_id, profile2_id],
            simulation_ids=[simulation_id],
        )
        mock_profile1 = MockProfile(profile1_id, "John", "Doe", "jdoe")
        mock_profile2 = MockProfile(profile2_id, "Jane", "Smith", "jsmith")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")

        mock_session.get.return_value = mock_cohort
        mock_session.exec.return_value.all.side_effect = [
            [mock_profile1, mock_profile2],
            [mock_simulation],
        ]

        result = cohort_overview(str(cohort_id))

        assert len(result["roster"]) == 2
        assert result["roster"][0]["first_name"] == "John"
        assert result["roster"][1]["first_name"] == "Jane"
        assert result["stats"]["total_students"] == 2

    def test_cohort_overview_array_filtering(self, mock_get_session):
        """Test cohort_overview with array filtering."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        profile_id = uuid.uuid4()
        simulation_id = uuid.uuid4()

        mock_cohort = MockCohort(
            cohort_id,
            "Filtered Cohort",
            profile_ids=[profile_id],
            simulation_ids=[simulation_id],
        )
        mock_profile = MockProfile(profile_id, "John", "Doe", "jdoe")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation")

        mock_session.get.return_value = mock_cohort
        mock_session.exec.return_value.all.side_effect = [
            [mock_profile],
            [mock_simulation],
        ]

        result = cohort_overview(str(cohort_id))

        assert len(result["roster"]) == 1
        assert len(result["simulations"]) == 1
        assert result["stats"]["total_students"] == 1
        assert result["stats"]["active_simulations"] == 1

    def test_cohort_overview_inactive_cohort(self, mock_get_session):
        """Test cohort_overview with inactive cohort."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        mock_cohort = MockCohort(cohort_id, "Inactive Cohort", active=False)

        mock_session.get.return_value = mock_cohort
        mock_session.exec.return_value.all.return_value = []

        result = cohort_overview(str(cohort_id))

        assert result["cohort"]["id"] == str(cohort_id)
        assert result["cohort"]["active"] is False
        assert result["roster"] == []
        assert result["simulations"] == []

    def test_cohort_overview_null_timestamps(self, mock_get_session):
        """Test cohort_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        mock_cohort = MockCohort(cohort_id, "Null Timestamp Cohort")
        mock_cohort.created_at = None
        mock_cohort.updated_at = None

        mock_session.get.return_value = mock_cohort
        mock_session.exec.return_value.all.return_value = []

        result = cohort_overview(str(cohort_id))

        assert result["cohort"]["id"] == str(cohort_id)
        assert result["cohort"]["created_at"] is None

    def test_cohort_overview_with_simulations(self, mock_get_session):
        """Test cohort_overview with simulations."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        simulation1_id = uuid.uuid4()
        simulation2_id = uuid.uuid4()

        mock_cohort = MockCohort(
            cohort_id,
            "Simulation Cohort",
            simulation_ids=[simulation1_id, simulation2_id],
        )
        mock_simulation1 = MockSimulation(simulation1_id, "Simulation 1", True, 30)
        mock_simulation2 = MockSimulation(simulation2_id, "Simulation 2", True, 45)

        mock_session.get.return_value = mock_cohort

        # Custom exec mock to handle .all() for each call, inspecting the SQL statement
        def exec_side_effect(stmt, *args, **kwargs):
            m = MagicMock()
            stmt_str = str(stmt)
            # If the query is for Profiles, return []
            if "FROM profiles" in stmt_str:
                m.all.return_value = []
            # If the query is for Simulations, return the two mock simulations
            elif "FROM simulations" in stmt_str:
                m.all.return_value = [mock_simulation1, mock_simulation2]
            else:
                m.all.return_value = []
            return m

        mock_session.exec.side_effect = exec_side_effect

        result = cohort_overview(str(cohort_id))

        assert len(result["simulations"]) == 2
        assert result["simulations"][0]["title"] == "Simulation 1"
        assert result["simulations"][1]["title"] == "Simulation 2"
        assert result["stats"]["active_simulations"] == 2

    def test_cohort_overview_student_details(self, mock_get_session):
        """Test cohort_overview with detailed student information."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cohort_id = uuid.uuid4()
        profile_id = uuid.uuid4()

        mock_cohort = MockCohort(
            cohort_id, "Student Details Cohort", profile_ids=[profile_id]
        )
        mock_profile = MockProfile(
            profile_id, "Alice", "Johnson", "ajohnson", "instructor"
        )

        mock_session.get.return_value = mock_cohort
        mock_session.exec.return_value.all.side_effect = [[mock_profile], []]

        result = cohort_overview(str(cohort_id))

        assert len(result["roster"]) == 1
        student = result["roster"][0]
        assert student["id"] == str(profile_id)
        assert student["first_name"] == "Alice"
        assert student["last_name"] == "Johnson"
        assert student["alias"] == "ajohnson"
        assert student["role"] == "instructor"

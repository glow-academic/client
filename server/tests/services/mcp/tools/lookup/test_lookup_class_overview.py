"""
Tests for app.services.mcp.tools.lookup.class_overview
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.lookup.class_overview import class_overview
from sqlalchemy.exc import SQLAlchemyError


class MockClass:
    def __init__(
        self, id, name, code, year=2025, term="Fall", desc="", profile_ids=None
    ):
        self.id = id
        self.name = name
        self.class_code = code
        self.year = year
        self.term = term
        self.description = desc
        self.profile_ids = profile_ids or []
        self.created_at = datetime.now()


class MockProfile:
    def __init__(self, id, fname, lname, alias, role="student"):
        self.id = id
        self.first_name = fname
        self.last_name = lname
        self.alias = alias
        self.role = role
        self.last_login = datetime.now()
        self.created_at = datetime.now()
        self.viewed_intro = False
        self.active = True


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


@patch("app.services.mcp.tools.lookup.class_overview.get_session")
class TestClassOverview:
    """Tests for class_overview function."""

    def test_class_overview_success(self, mock_get_session):
        """Test successful class_overview execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        class_id = uuid.uuid4()
        profile_id = uuid.uuid4()

        mock_class = MockClass(
            class_id, "Test Class", "CS101", profile_ids=[profile_id]
        )
        mock_profiles = [MockProfile(profile_id, "John", "Doe", "jdoe")]
        mock_scenarios = [MockScenario(uuid.uuid4(), "Class Scenario", "Desc")]

        mock_session.get.return_value = mock_class
        mock_session.exec.return_value.all.side_effect = [mock_profiles, mock_scenarios]

        result = class_overview(str(class_id))

        assert result["class"]["id"] == str(class_id)
        assert result["class"]["name"] == "Test Class"
        assert result["class"]["class_code"] == "CS101"
        assert result["class"]["year"] == 2025
        assert result["class"]["term"] == "Fall"
        assert len(result["roster"]) == 1
        assert result["roster"][0]["alias"] == "jdoe"
        assert result["roster"][0]["first_name"] == "John"
        assert result["roster"][0]["last_name"] == "Doe"
        assert len(result["scenarios"]) == 1
        assert result["scenarios"][0]["name"] == "Class Scenario"

    def test_class_overview_not_found(self, mock_get_session):
        """Test class_overview when class is not found."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.get.return_value = None

        result = class_overview(str(uuid.uuid4()))

        assert "error" in result
        assert "not found" in result["error"]

    def test_class_overview_invalid_uuid(self, mock_get_session):
        """Test class_overview with invalid UUID format."""
        result = class_overview("invalid-uuid")

        assert "error" in result
        assert "Invalid class_id format" in result["error"]

    def test_class_overview_database_error(self, mock_get_session):
        """Test class_overview database error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")

        result = class_overview(str(uuid.uuid4()))

        assert "error" in result
        assert "Database error" in result["error"]

    def test_class_overview_empty_roster(self, mock_get_session):
        """Test class_overview when class has no students."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        class_id = uuid.uuid4()

        mock_class = MockClass(class_id, "Test Class", "CS101")
        mock_scenarios = []

        mock_session.get.return_value = mock_class
        mock_session.exec.return_value.all.side_effect = [[], mock_scenarios]

        result = class_overview(str(class_id))

        assert result["roster"] == []
        assert result["scenarios"] == []

    def test_class_overview_multiple_students(self, mock_get_session):
        """Test class_overview with multiple students in roster."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        class_id = uuid.uuid4()
        profile_ids = [uuid.uuid4(), uuid.uuid4(), uuid.uuid4()]

        mock_class = MockClass(class_id, "Test Class", "CS101", profile_ids=profile_ids)
        mock_profiles = [
            MockProfile(profile_ids[0], "John", "Doe", "jdoe"),
            MockProfile(profile_ids[1], "Jane", "Smith", "jsmith"),
            MockProfile(profile_ids[2], "Bob", "Johnson", "bjohnson"),
        ]
        mock_scenarios = []

        mock_session.get.return_value = mock_class
        mock_session.exec.return_value.all.side_effect = [mock_profiles, mock_scenarios]

        result = class_overview(str(class_id))

        assert len(result["roster"]) == 3
        assert result["roster"][0]["alias"] == "jdoe"
        assert result["roster"][1]["alias"] == "jsmith"
        assert result["roster"][2]["alias"] == "bjohnson"

    def test_class_overview_array_filtering(self, mock_get_session):
        """Test class_overview array filtering logic."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        class_id = uuid.uuid4()
        profile_id_1 = uuid.uuid4()
        profile_id_2 = uuid.uuid4()

        # Class only has profile_id_1 and profile_id_2 in its profile_ids array
        mock_class = MockClass(
            class_id, "Test Class", "CS101", profile_ids=[profile_id_1, profile_id_2]
        )
        # Only profiles that are in the class's profile_ids array should be returned
        mock_profiles = [
            MockProfile(profile_id_1, "John", "Doe", "jdoe"),  # Should be included
            MockProfile(
                profile_id_2, "Bob", "Johnson", "bjohnson"
            ),  # Should be included
        ]
        mock_scenarios = []

        mock_session.get.return_value = mock_class
        mock_session.exec.return_value.all.side_effect = [mock_profiles, mock_scenarios]

        result = class_overview(str(class_id))

        # Should only include profiles that are in the class's profile_ids array
        assert len(result["roster"]) == 2
        assert result["roster"][0]["alias"] == "jdoe"
        assert result["roster"][1]["alias"] == "bjohnson"

    def test_class_overview_null_timestamps(self, mock_get_session):
        """Test class_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        class_id = uuid.uuid4()

        mock_class = MockClass(class_id, "Test Class", "CS101")
        mock_class.created_at = None

        mock_session.get.return_value = mock_class
        mock_session.exec.return_value.all.side_effect = [[], []]

        result = class_overview(str(class_id))

        assert result["class"]["created_at"] is None




@pytest.mark.skip(reason="TODO: implement tests for `class_overview`")
class TestClass_Overview:
    """Tests for class_overview function."""

    def test_class_overview_success(self):
        """Test successful class_overview execution."""
        # TODO: Implement test for class_overview
        assert False, "IMPLEMENT: Test for class_overview"

    def test_class_overview_error(self):
        """Test class_overview error handling."""
        # TODO: Implement error test for class_overview
        assert False, "IMPLEMENT: Error test for class_overview"

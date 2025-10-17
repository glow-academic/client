"""
Tests for app.mcp.tools.lookup.persona_overview
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.mcp.tools.lookup.persona_overview import persona_overview
from sqlalchemy.exc import SQLAlchemyError


class MockPersona:
    def __init__(
        self,
        id,
        name,
        description,
        system_prompt,
        temperature=0.7,
        default_persona=False,
    ):
        self.id = id
        self.name = name
        self.description = description
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.default_persona = default_persona
        self.created_at = datetime.now()
        self.updated_at = datetime.now()


class MockScenario:
    def __init__(self, id, name, description, default_scenario=False):
        self.id = id
        self.name = name
        self.description = description
        self.default_scenario = default_scenario
        self.created_at = datetime.now()


@patch("app.mcp.tools.lookup.persona_overview.get_session")
class TestPersona_Overview:
    """Tests for persona_overview function."""

    def test_persona_overview_success(self, mock_get_session):
        """Test successful persona_overview execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        persona_id = uuid.uuid4()
        scenario_id = uuid.uuid4()

        mock_persona = MockPersona(
            persona_id,
            "Aggressive Manager",
            "A challenging persona for conflict resolution",
            "You are an aggressive manager...",
        )
        mock_scenario = MockScenario(
            scenario_id,
            "Conflict Resolution",
            "Handle a difficult employee situation",
            False,
        )

        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = [mock_scenario]

        result = persona_overview(str(persona_id))

        assert result["id"] == str(persona_id)
        assert result["name"] == "Aggressive Manager"
        assert result["description"] == "A challenging persona for conflict resolution"
        assert result["system_prompt"] == "You are an aggressive manager..."
        assert result["temperature"] == 0.7
        assert result["default_persona"] is False
        assert result["scenario_count"] == 1
        assert len(result["scenarios"]) == 1
        assert result["scenarios"][0]["id"] == str(scenario_id)
        assert result["scenarios"][0]["name"] == "Conflict Resolution"

    def test_persona_overview_error(self, mock_get_session):
        """Test persona_overview error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        persona_id = uuid.uuid4()

        mock_session.get.return_value = None

        result = persona_overview(str(persona_id))

        assert "error" in result
        assert "Persona not found" in result["error"]
        assert str(persona_id) in result["error"]

    def test_persona_overview_invalid_uuid(self, mock_get_session):
        """Test persona_overview with invalid UUID."""
        result = persona_overview("invalid-uuid")

        assert "error" in result
        assert "Invalid persona_id format" in result["error"]

    def test_persona_overview_database_error(self, mock_get_session):
        """Test persona_overview database error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        persona_id = uuid.uuid4()

        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")

        result = persona_overview(str(persona_id))

        assert "error" in result
        assert "Database error" in result["error"]

    def test_persona_overview_no_scenarios(self, mock_get_session):
        """Test persona_overview with no associated scenarios."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        persona_id = uuid.uuid4()

        mock_persona = MockPersona(
            persona_id,
            "Friendly Manager",
            "A supportive persona for mentoring",
            "You are a friendly manager...",
        )

        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = []

        result = persona_overview(str(persona_id))

        assert result["id"] == str(persona_id)
        assert result["name"] == "Friendly Manager"
        assert result["scenario_count"] == 0
        assert result["scenarios"] == []

    def test_persona_overview_multiple_scenarios(self, mock_get_session):
        """Test persona_overview with multiple scenarios."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        persona_id = uuid.uuid4()
        scenario1_id = uuid.uuid4()
        scenario2_id = uuid.uuid4()

        mock_persona = MockPersona(
            persona_id,
            "Versatile Manager",
            "A flexible persona for various situations",
            "You are a versatile manager...",
        )
        mock_scenario1 = MockScenario(
            scenario1_id, "Scenario 1", "First scenario", True
        )
        mock_scenario2 = MockScenario(
            scenario2_id, "Scenario 2", "Second scenario", False
        )

        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = [
            mock_scenario1,
            mock_scenario2,
        ]

        result = persona_overview(str(persona_id))

        assert result["scenario_count"] == 2
        assert len(result["scenarios"]) == 2
        assert result["scenarios"][0]["default_scenario"] is True
        assert result["scenarios"][1]["default_scenario"] is False

    def test_persona_overview_null_timestamps(self, mock_get_session):
        """Test persona_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        persona_id = uuid.uuid4()

        mock_persona = MockPersona(
            persona_id, "Test Persona", "Test description", "Test prompt"
        )
        mock_persona.created_at = None
        mock_persona.updated_at = None

        mock_session.get.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = []

        result = persona_overview(str(persona_id))

        assert result["created_at"] is None
        assert result["updated_at"] is None

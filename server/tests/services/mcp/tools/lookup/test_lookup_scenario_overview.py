"""
Tests for app.services.mcp.tools.lookup.scenario_overview
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.lookup.scenario_overview import scenario_overview
from sqlalchemy.exc import SQLAlchemyError


class MockScenario:
    def __init__(self, id, name, description, default_scenario=False):
        self.id = id
        self.name = name
        self.description = description
        self.default_scenario = default_scenario
        self.created_at = datetime.now()
        self.updated_at = datetime.now()


class MockPersona:
    def __init__(self, id, name, description):
        self.id = id
        self.name = name
        self.description = description


class MockSimulationChat:
    def __init__(self, id, created_at, completed_at=None):
        self.id = id
        self.created_at = created_at
        self.completed_at = completed_at


@patch("app.services.mcp.tools.lookup.scenario_overview.get_session")
class TestScenario_Overview:
    """Tests for scenario_overview function."""

    def test_scenario_overview_success(self, mock_get_session):
        """Test successful scenario_overview execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        persona_id = uuid.uuid4()
        
        mock_scenario = MockScenario(scenario_id, "Conflict Resolution", "Handle difficult employee situation")
        mock_persona = MockPersona(persona_id, "Aggressive Manager", "A challenging persona")
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.first.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = []
        
        result = scenario_overview(str(scenario_id))
        
        assert result["scenario"]["id"] == str(scenario_id)
        assert result["scenario"]["name"] == "Conflict Resolution"
        assert result["scenario"]["description"] == "Handle difficult employee situation"
        assert result["scenario"]["default_scenario"] is False
        assert result["persona"]["id"] == str(persona_id)
        assert result["persona"]["name"] == "Aggressive Manager"
        assert result["simulations"] == []

    def test_scenario_overview_error(self, mock_get_session):
        """Test scenario_overview error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        mock_session.get.side_effect = SQLAlchemyError("Database connection failed")
        
        result = scenario_overview(str(scenario_id))
        
        assert "error" in result
        assert "Database error" in result["error"]

    def test_scenario_overview_scenario_not_found(self, mock_get_session):
        """Test scenario_overview with non-existent scenario."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        mock_session.get.return_value = None
        
        result = scenario_overview(str(scenario_id))
        
        assert "error" in result
        assert "Scenario not found" in result["error"]

    def test_scenario_overview_invalid_uuid(self, mock_get_session):
        """Test scenario_overview with invalid UUID."""
        result = scenario_overview("invalid-uuid")
        
        assert "error" in result
        assert "Invalid scenario_id format" in result["error"]

    def test_scenario_overview_no_persona(self, mock_get_session):
        """Test scenario_overview with no associated persona."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        mock_scenario = MockScenario(scenario_id, "Test Scenario", "Test description")
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.first.return_value = None  # No persona
        mock_session.exec.return_value.all.return_value = []
        
        result = scenario_overview(str(scenario_id))
        
        assert result["scenario"]["id"] == str(scenario_id)
        assert result["persona"] is None
        assert result["simulations"] == []

    def test_scenario_overview_with_simulations(self, mock_get_session):
        """Test scenario_overview with associated simulations."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        persona_id = uuid.uuid4()
        
        mock_scenario = MockScenario(scenario_id, "Test Scenario", "Test description")
        mock_persona = MockPersona(persona_id, "Test Persona", "Test persona description")
        
        # Mock simulation data
        simulation_data = [
            {"id": str(uuid.uuid4()), "title": "Simulation 1", "attempts": 5},
            {"id": str(uuid.uuid4()), "title": "Simulation 2", "attempts": 3},
        ]
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.first.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = simulation_data
        
        result = scenario_overview(str(scenario_id))
        
        assert len(result["simulations"]) == 2
        assert result["simulations"][0]["title"] == "Simulation 1"
        assert result["simulations"][1]["title"] == "Simulation 2"

    def test_scenario_overview_default_scenario(self, mock_get_session):
        """Test scenario_overview with default scenario."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        persona_id = uuid.uuid4()
        
        mock_scenario = MockScenario(scenario_id, "Default Scenario", "Default description", True)
        mock_persona = MockPersona(persona_id, "Test Persona", "Test persona description")
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.first.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = []
        
        result = scenario_overview(str(scenario_id))
        
        assert result["scenario"]["default_scenario"] is True

    def test_scenario_overview_null_timestamps(self, mock_get_session):
        """Test scenario_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        persona_id = uuid.uuid4()
        
        mock_scenario = MockScenario(scenario_id, "Test Scenario", "Test description")
        mock_scenario.created_at = None
        mock_scenario.updated_at = None
        mock_persona = MockPersona(persona_id, "Test Persona", "Test persona description")
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.first.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = []
        
        result = scenario_overview(str(scenario_id))
        
        assert result["scenario"]["created_at"] is None
        assert result["scenario"]["updated_at"] is None

    def test_scenario_overview_simulation_details(self, mock_get_session):
        """Test scenario_overview with detailed simulation information."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        persona_id = uuid.uuid4()
        
        mock_scenario = MockScenario(scenario_id, "Test Scenario", "Test description")
        mock_persona = MockPersona(persona_id, "Test Persona", "Test persona description")
        
        # Mock detailed simulation data
        simulation_data = [
            {
                "id": str(uuid.uuid4()),
                "title": "Detailed Simulation",
                "attempts": 10,
                "pass_rate": 80.0,
                "average_score": 85.5
            }
        ]
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.first.return_value = mock_persona
        mock_session.exec.return_value.all.return_value = simulation_data
        
        result = scenario_overview(str(scenario_id))
        
        assert len(result["simulations"]) == 1
        simulation = result["simulations"][0]
        assert simulation["title"] == "Detailed Simulation"
        assert simulation["attempts"] == 10
        assert simulation["pass_rate"] == 80.0
        assert simulation["average_score"] == 85.5

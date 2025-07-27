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
    def __init__(self, id, name, description, default_scenario=False, persona_id=None):
        self.id = id
        self.name = name
        self.description = description
        self.default_scenario = default_scenario
        self.persona_id = persona_id
        self.created_at = datetime.now()
        self.updated_at = datetime.now()


class MockSimulation:
    def __init__(self, id, title, active=True, time_limit=30, scenario_ids=None):
        self.id = id
        self.title = title
        self.active = active
        self.time_limit = time_limit
        self.scenario_ids = scenario_ids or []
        self.created_at = datetime.now()


@patch("app.services.mcp.tools.lookup.scenario_overview.get_session")
class TestScenario_Overview:
    """Tests for scenario_overview function."""

    def test_scenario_overview_success(self, mock_get_session):
        """Test successful scenario_overview execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        persona_id = uuid.uuid4()
        
        mock_scenario = MockScenario(scenario_id, "Conflict Resolution", "Handle difficult employee situation", persona_id=persona_id)
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.all.return_value = []
        
        result = scenario_overview(str(scenario_id))
        
        assert result["id"] == str(scenario_id)
        assert result["name"] == "Conflict Resolution"
        assert result["description"] == "Handle difficult employee situation"
        assert result["default_scenario"] is False
        assert result["persona_id"] == str(persona_id)
        assert result["simulations"] == []
        assert result["simulation_count"] == 0

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
        mock_scenario = MockScenario(scenario_id, "No Persona Scenario", "A scenario without persona")
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.all.return_value = []
        
        result = scenario_overview(str(scenario_id))
        
        assert result["id"] == str(scenario_id)
        assert result["name"] == "No Persona Scenario"
        assert result["persona_id"] is None
        assert result["simulations"] == []

    def test_scenario_overview_with_simulations(self, mock_get_session):
        """Test scenario_overview with associated simulations."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        
        mock_scenario = MockScenario(scenario_id, "Test Scenario", "A test scenario")
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", scenario_ids=[scenario_id])
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.all.return_value = [mock_simulation]
        
        result = scenario_overview(str(scenario_id))
        
        assert result["id"] == str(scenario_id)
        assert len(result["simulations"]) == 1
        assert result["simulations"][0]["id"] == str(simulation_id)
        assert result["simulations"][0]["title"] == "Test Simulation"
        assert result["simulation_count"] == 1

    def test_scenario_overview_default_scenario(self, mock_get_session):
        """Test scenario_overview with default scenario."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        mock_scenario = MockScenario(scenario_id, "Default Scenario", "A default scenario", default_scenario=True)
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.all.return_value = []
        
        result = scenario_overview(str(scenario_id))
        
        assert result["id"] == str(scenario_id)
        assert result["name"] == "Default Scenario"
        assert result["default_scenario"] is True
        assert result["simulations"] == []

    def test_scenario_overview_null_timestamps(self, mock_get_session):
        """Test scenario_overview with null timestamps."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        mock_scenario = MockScenario(scenario_id, "Null Timestamp Scenario", "A scenario with null timestamps")
        mock_scenario.created_at = None
        mock_scenario.updated_at = None
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.all.return_value = []
        
        result = scenario_overview(str(scenario_id))
        
        assert result["id"] == str(scenario_id)
        assert result["created_at"] is None
        assert result["updated_at"] is None

    def test_scenario_overview_simulation_details(self, mock_get_session):
        """Test scenario_overview with detailed simulation information."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        scenario_id = uuid.uuid4()
        simulation1_id = uuid.uuid4()
        simulation2_id = uuid.uuid4()
        
        mock_scenario = MockScenario(scenario_id, "Multi-Sim Scenario", "A scenario with multiple simulations")
        mock_simulation1 = MockSimulation(simulation1_id, "Simulation 1", True, 30, [scenario_id])
        mock_simulation2 = MockSimulation(simulation2_id, "Simulation 2", False, 45, [scenario_id])
        
        mock_session.get.return_value = mock_scenario
        mock_session.exec.return_value.all.return_value = [mock_simulation1, mock_simulation2]
        
        result = scenario_overview(str(scenario_id))
        
        assert result["id"] == str(scenario_id)
        assert len(result["simulations"]) == 2
        assert result["simulation_count"] == 2
        
        # Check first simulation
        sim1 = result["simulations"][0]
        assert sim1["id"] == str(simulation1_id)
        assert sim1["title"] == "Simulation 1"
        assert sim1["active"] is True
        assert sim1["time_limit"] == 30
        
        # Check second simulation
        sim2 = result["simulations"][1]
        assert sim2["id"] == str(simulation2_id)
        assert sim2["title"] == "Simulation 2"
        assert sim2["active"] is False
        assert sim2["time_limit"] == 45

# tests/services/mcp/tools/search/test_find_simulations.py

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.search.find_simulations import find_simulations

class MockSimulation:
    def __init__(self, id, title, active=True, time_limit=30):
        self.id, self.title, self.active, self.time_limit = id, title, active, time_limit
        self.created_at = datetime.now()

@patch("app.services.mcp.tools.search.find_simulations.get_session")
class TestFind_Simulations:
    """Tests for find_simulations function."""

    def test_find_simulations_success(self, mock_get_session):
        """Test successful simulation search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_sim = MockSimulation(id=uuid.uuid4(), title="Cardiac Arrest Scenario")
        mock_session.exec.return_value.all.return_value = [mock_sim]

        result = find_simulations(query="Cardiac")

        assert len(result) == 1
        assert result[0]["id"] == str(mock_sim.id)
        assert result[0]["title"] == "Cardiac Arrest Scenario"
        mock_session.close.assert_called_once()

    def test_find_simulations_no_results(self, mock_get_session):
        """Test search that yields no results."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.return_value.all.return_value = []

        result = find_simulations(query="NonExistent")

        assert result == []

    def test_find_simulations_error(self, mock_get_session):
        """Test database error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.side_effect = SQLAlchemyError("DB Error")

        result = find_simulations(query="Test")

        assert result == [{"error": "Database error: DB Error"}]
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.search.find_simulations import find_simulations


class MockSimulation:
    def __init__(self, id, title, active=True, time_limit=30):
        self.id = id
        self.title = title
        self.active = active
        self.time_limit = time_limit
        self.created_at = datetime.now()


@patch("app.services.mcp.tools.search.find_simulations.get_session")
class TestFind_Simulations:
    """Tests for find_simulations function."""

    def test_find_simulations_success(self, mock_get_session):
        """Test successful simulation search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_sim = MockSimulation(id=uuid.uuid4(), title="Induction Homework Scenario")
        mock_session.exec.return_value.all.return_value = [mock_sim]

        result = find_simulations(query="Induction")

        assert len(result) == 1
        r0 = result[0]
        assert r0["id"] == str(mock_sim.id)
        assert r0["title"] == "Induction Homework Scenario"
        assert "score" in r0
        assert isinstance(r0["score"], int)
        assert r0["score"] > 0
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

    def test_find_simulations_ranking(self, mock_get_session):
        """Ensure best match sorts first."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        sim_exact = MockSimulation(uuid.uuid4(), "Induction Homework")
        sim_prefix = MockSimulation(uuid.uuid4(), "Induction Homework Scenario")
        sim_far = MockSimulation(uuid.uuid4(), "Respiratory Distress")

        # Return reversed order to ensure re-ranking works
        mock_session.exec.return_value.all.return_value = [
            sim_far,
            sim_prefix,
            sim_exact,
        ]

        result = find_simulations(query="Induction", limit=5)

        assert len(result) == 3
        assert result[0]["title"] == "Induction Homework"
        assert result[0]["score"] > result[1]["score"] >= result[2]["score"]

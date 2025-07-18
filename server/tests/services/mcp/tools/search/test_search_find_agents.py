# tests/services/mcp/tools/search/test_find_agents.py

"""
Tests for app.services.mcp.tools.search.find_agents
"""

import uuid
from unittest.mock import MagicMock, patch

from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.search.find_agents import find_agents


class MockAgent:
    """Helper class to mock the Agents model object."""

    def __init__(self, id, name, description):
        self.id = id
        self.name = name
        self.description = description


@patch("app.services.mcp.tools.search.find_agents.get_session")
class TestFind_Agents:
    """Tests for find_agents function."""

    def test_find_agents_success(self, mock_get_session):
        """Test successful find_agents execution with a valid query."""
        # --- Arrange ---
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_agent = MockAgent(
            uuid.uuid4(),
            "Aggressive Agent",
            "An agent simulating an aggressive student.",
        )
        # find_agents() does session.exec(...).all(), so return list
        mock_session.exec.return_value.all.return_value = [mock_agent]

        # --- Act ---
        result = find_agents(query="Aggressive")

        # --- Assert ---
        assert len(result) == 1
        assert result[0]["id"] == str(mock_agent.id)
        assert result[0]["name"] == "Aggressive Agent"
        assert result[0]["description"] == "An agent simulating an aggressive student."
        assert "score" in result[0]
        assert isinstance(result[0]["score"], int)
        assert result[0]["score"] > 0  # score should be positive for a match

    def test_find_agents_ranking(self, mock_get_session):
        """Agents are returned sorted by score (best match first)."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        a_exact = MockAgent(uuid.uuid4(), "Tutor Bot", "Helps students")
        a_prefix = MockAgent(uuid.uuid4(), "Tutor Assistant", "Assistive")
        a_far = MockAgent(uuid.uuid4(), "Other Agent", "Unrelated")

        mock_session.exec.return_value.all.return_value = [a_far, a_prefix, a_exact]

        result = find_agents(query="Tutor")

        # first should be exact match "Tutor Bot" (score 100)
        assert result[0]["name"] == "Tutor Bot"
        assert result[0]["score"] >= result[1]["score"] >= result[2]["score"]

    def test_find_agents_error(self, mock_get_session):
        """Test find_agents error handling during a database failure."""
        # --- Arrange ---
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        # Configure the mock to raise a SQLAlchemyError
        mock_session.exec.side_effect = SQLAlchemyError("Database connection failed")

        # --- Act ---
        result = find_agents(query="Any Agent")

        # --- Assert ---
        assert result == [{"error": "Database error: Database connection failed"}]

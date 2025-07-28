"""
Tests for app.services.mcp.tools.search.find_personas
"""

import uuid
from unittest.mock import MagicMock, patch

from app.services.mcp.tools.search.find_personas import find_personas
from sqlalchemy.exc import SQLAlchemyError


class MockPersona:
    def __init__(self, id, name, description):
        self.id = id
        self.name = name
        self.description = description


@patch("app.services.mcp.tools.search.find_personas.get_session")
class TestFind_Personas:
    """Tests for find_personas function."""

    def test_find_personas_success(self, mock_get_session):
        """Test successful find_personas execution."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        persona1_id = uuid.uuid4()
        persona2_id = uuid.uuid4()

        mock_persona1 = MockPersona(
            persona1_id, "Aggressive Manager", "A challenging persona"
        )
        mock_persona2 = MockPersona(
            persona2_id, "Friendly Manager", "A supportive persona"
        )

        mock_session.exec.return_value.all.return_value = [mock_persona1, mock_persona2]

        result = find_personas("manager")

        assert len(result) == 2

        # Check that both personas are in the results (order may vary due to sorting)
        persona_names = [p["name"] for p in result]
        assert "Aggressive Manager" in persona_names
        assert "Friendly Manager" in persona_names

        # Check that all results have required fields
        for persona in result:
            assert "id" in persona
            assert "name" in persona
            assert "description" in persona
            assert "score" in persona

    def test_find_personas_error(self, mock_get_session):
        """Test find_personas error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_session.exec.side_effect = SQLAlchemyError("Database connection failed")

        result = find_personas("test")

        assert len(result) == 1
        assert "error" in result[0]
        assert "Database error" in result[0]["error"]

    def test_find_personas_empty_query(self, mock_get_session):
        """Test find_personas with empty query."""
        result = find_personas("")

        assert result == []

    def test_find_personas_whitespace_query(self, mock_get_session):
        """Test find_personas with whitespace-only query."""
        result = find_personas("   ")

        assert result == []

    def test_find_personas_no_results(self, mock_get_session):
        """Test find_personas with no matching results."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_session.exec.return_value.all.return_value = []

        result = find_personas("nonexistent")

        assert result == []

    def test_find_personas_exact_match(self, mock_get_session):
        """Test find_personas with exact match."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Exact Match", "Exact match persona")

        mock_session.exec.return_value.all.return_value = [mock_persona]

        result = find_personas("Exact Match")

        assert len(result) == 1
        assert result[0]["name"] == "Exact Match"
        assert result[0]["score"] >= 100  # Exact match should have high score

    def test_find_personas_prefix_match(self, mock_get_session):
        """Test find_personas with prefix match."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Manager Persona", "A manager persona")

        mock_session.exec.return_value.all.return_value = [mock_persona]

        result = find_personas("Manager")

        assert len(result) == 1
        assert result[0]["name"] == "Manager Persona"
        assert result[0]["score"] >= 60  # Prefix match should have good score

    def test_find_personas_case_insensitive(self, mock_get_session):
        """Test find_personas with case insensitive search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "Manager Persona", "A manager persona")

        mock_session.exec.return_value.all.return_value = [mock_persona]

        result = find_personas("manager")

        assert len(result) == 1
        assert result[0]["name"] == "Manager Persona"

    def test_find_personas_with_limit(self, mock_get_session):
        """Test find_personas with custom limit."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        # Create more personas than the limit
        personas = []
        for i in range(15):
            persona_id = uuid.uuid4()
            mock_persona = MockPersona(
                persona_id, f"Manager {i}", f"Manager persona {i}"
            )
            personas.append(mock_persona)

        mock_session.exec.return_value.all.return_value = personas

        result = find_personas("Manager", limit=5)

        assert len(result) <= 5

    def test_find_personas_sorted_by_score(self, mock_get_session):
        """Test find_personas results are sorted by score."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        persona1_id = uuid.uuid4()
        persona2_id = uuid.uuid4()

        # Create personas with different match qualities
        mock_persona1 = MockPersona(persona1_id, "Exact Manager", "Exact match")
        mock_persona2 = MockPersona(
            persona2_id, "Some Other Manager", "Contains manager"
        )

        mock_session.exec.return_value.all.return_value = [mock_persona1, mock_persona2]

        result = find_personas("Exact Manager")

        assert len(result) == 2

        # The exact match should have a higher score
        exact_match = next((p for p in result if p["name"] == "Exact Manager"), None)
        other_match = next(
            (p for p in result if p["name"] == "Some Other Manager"), None
        )

        assert exact_match is not None
        assert other_match is not None
        assert exact_match["score"] >= other_match["score"]

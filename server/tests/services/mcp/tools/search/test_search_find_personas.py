"""
Tests for app.services.mcp.tools.search.find_personas
"""

import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
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
        
        mock_persona1 = MockPersona(persona1_id, "Aggressive Manager", "A challenging persona")
        mock_persona2 = MockPersona(persona2_id, "Friendly Manager", "A supportive persona")
        
        mock_session.exec.return_value.all.return_value = [mock_persona1, mock_persona2]
        
        result = find_personas("manager")
        
        assert len(result) == 2
        assert result[0]["id"] == str(persona1_id)
        assert result[0]["name"] == "Aggressive Manager"
        assert result[0]["description"] == "A challenging persona"
        assert "score" in result[0]
        assert result[1]["id"] == str(persona2_id)
        assert result[1]["name"] == "Friendly Manager"
        assert result[1]["description"] == "A supportive persona"
        assert "score" in result[1]

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
        mock_persona = MockPersona(persona_id, "PrefixTest", "Prefix match persona")
        
        mock_session.exec.return_value.all.return_value = [mock_persona]
        
        result = find_personas("prefix")
        
        assert len(result) == 1
        assert result[0]["name"] == "PrefixTest"
        assert result[0]["score"] >= 60  # Prefix match should have good score

    def test_find_personas_case_insensitive(self, mock_get_session):
        """Test find_personas case insensitivity."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona_id = uuid.uuid4()
        mock_persona = MockPersona(persona_id, "CaseTest", "Case test persona")
        
        mock_session.exec.return_value.all.return_value = [mock_persona]
        
        result = find_personas("case")
        
        assert len(result) == 1
        assert result[0]["name"] == "CaseTest"

    def test_find_personas_with_limit(self, mock_get_session):
        """Test find_personas with custom limit."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        personas = []
        for i in range(15):
            persona_id = uuid.uuid4()
            mock_persona = MockPersona(persona_id, f"Persona {i}", f"Description {i}")
            personas.append(mock_persona)
        
        mock_session.exec.return_value.all.return_value = personas
        
        result = find_personas("persona", limit=5)
        
        assert len(result) == 5

    def test_find_personas_sorted_by_score(self, mock_get_session):
        """Test find_personas results are sorted by score."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        
        persona1_id = uuid.uuid4()
        persona2_id = uuid.uuid4()
        
        # Exact match should score higher than partial match
        mock_persona1 = MockPersona(persona1_id, "ExactMatch", "Exact match")
        mock_persona2 = MockPersona(persona2_id, "ContainsMatch", "Contains match")
        
        mock_session.exec.return_value.all.return_value = [mock_persona1, mock_persona2]
        
        result = find_personas("ExactMatch")
        
        assert len(result) == 2
        # Exact match should come first
        assert result[0]["name"] == "ExactMatch"
        assert result[0]["score"] > result[1]["score"]


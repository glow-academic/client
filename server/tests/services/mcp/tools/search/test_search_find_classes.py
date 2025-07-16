# tests/services/mcp/tools/search/test_find_classes.py

import uuid
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.search.find_classes import find_classes

class MockClass:
    def __init__(self, id, name, class_code, year, term, description):
        self.id, self.name, self.class_code, self.year, self.term, self.description = id, name, class_code, year, term, description

@patch("app.services.mcp.tools.search.find_classes.get_session")
class TestFind_Classes:
    """Tests for find_classes function."""

    def test_find_classes_success(self, mock_get_session):
        """Test successful class search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_class = MockClass(
            id=uuid.uuid4(),
            name="Introduction to Biology",
            class_code="BIOL-101",
            year=2025,
            term="Fall",
            description="A test class."
        )
        mock_session.exec.return_value.all.return_value = [mock_class]

        result = find_classes(query="Biology")

        assert len(result) == 1
        assert result[0]["id"] == str(mock_class.id)
        assert result[0]["name"] == "Introduction to Biology"
        mock_session.close.assert_called_once()
    
    def test_find_classes_no_results(self, mock_get_session):
        """Test search that yields no results."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.return_value.all.return_value = []

        result = find_classes(query="NonExistent")

        assert result == []

    def test_find_classes_error(self, mock_get_session):
        """Test database error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.side_effect = SQLAlchemyError("DB Error")

        result = find_classes(query="Biology")

        assert result == [{"error": "Database error: DB Error"}]
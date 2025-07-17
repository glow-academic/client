# tests/services/mcp/tools/search/test_find_classes.py

import uuid
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.search.find_classes import find_classes


class MockClass:
    def __init__(self, id, name, class_code, year, term, description):
        self.id = id
        self.name = name
        self.class_code = class_code
        self.year = year
        self.term = term
        self.description = description


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
            description="A test class.",
        )
        mock_session.exec.return_value.all.return_value = [mock_class]

        result = find_classes(query="Biology")

        assert len(result) == 1
        r0 = result[0]
        assert r0["id"] == str(mock_class.id)
        assert r0["name"] == "Introduction to Biology"
        assert r0["class_code"] == "BIOL-101"
        assert "score" in r0
        assert isinstance(r0["score"], int)
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

    def test_find_classes_ranking(self, mock_get_session):
        """Best match (exact code) should be first."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        cls_exact_code = MockClass(
            id=uuid.uuid4(),
            name="Intro Biology",
            class_code="BIOL-101",
            year=2025,
            term="Fall",
            description="Bio intro.",
        )
        cls_prefix_code = MockClass(
            id=uuid.uuid4(),
            name="Biology Lab",
            class_code="BIOL-200",
            year=2025,
            term="Spring",
            description="Lab.",
        )
        cls_name_only = MockClass(
            id=uuid.uuid4(),
            name="Marine Biology Seminar",
            class_code="MARBIO-400",
            year=2025,
            term="Summer",
            description="Seminar.",
        )

        # Return reversed order to ensure sorting happens
        mock_session.exec.return_value.all.return_value = [cls_name_only, cls_prefix_code, cls_exact_code]

        result = find_classes(query="BIOL-101", limit=5)

        assert len(result) == 3
        assert result[0]["class_code"] == "BIOL-101"
        assert result[0]["score"] > result[1]["score"] >= result[2]["score"]

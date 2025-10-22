"""
Tests for app.utils.search
"""

import pytest
from app.utils.search import *  # type: ignore


class TestNormalize_Text:
    """Tests for normalize_text function."""

    def test_normalize_text_success(self) -> None:
        """Test successful normalize_text execution."""
        from app.utils.search import normalize_text

        result = normalize_text("Hello World")
        assert result == "hello world"

    def test_normalize_text_accents(self) -> None:
        """Test normalize_text with accents."""
        from app.utils.search import normalize_text

        result = normalize_text("Café résumé")
        assert result == "cafe resume"

    def test_normalize_text_whitespace(self) -> None:
        """Test normalize_text with multiple whitespace."""
        from app.utils.search import normalize_text

        result = normalize_text("Hello    World  \n\t  Test")
        assert result == "hello world test"


class TestTokenize:
    """Tests for tokenize function."""

    def test_tokenize_success(self) -> None:
        """Test successful tokenize execution."""
        from app.utils.search import tokenize

        result = tokenize("Hello World Test")
        assert result == ["hello", "world", "test"]

    def test_tokenize_empty(self) -> None:
        """Test tokenize with empty string."""
        from app.utils.search import tokenize

        result = tokenize("")
        assert result == []

    def test_tokenize_whitespace_only(self) -> None:
        """Test tokenize with whitespace only."""
        from app.utils.search import tokenize

        result = tokenize("   \n\t  ")
        assert result == []


class TestBuild_Fuzzy_Conditions:
    """Tests for build_fuzzy_conditions function."""

    def test_build_fuzzy_conditions_success(self) -> None:
        """Test successful build_fuzzy_conditions execution."""
        from app.utils.search import build_fuzzy_conditions

        fields = ["s.name", "s.description"]
        query = "test query"

        where_clause, params, next_idx = build_fuzzy_conditions(fields, query, 1)

        # Should return a where clause with multiple conditions
        assert isinstance(where_clause, str)
        assert "LOWER(s.name)" in where_clause
        assert "LOWER(s.description)" in where_clause
        assert "OR" in where_clause

        # Should return parameters
        assert isinstance(params, list)
        assert len(params) > 0

        # Should return next index
        assert next_idx > 1

    def test_build_fuzzy_conditions_single_field(self) -> None:
        """Test build_fuzzy_conditions with single field."""
        from app.utils.search import build_fuzzy_conditions

        fields = ["s.name"]
        query = "test"

        where_clause, params, next_idx = build_fuzzy_conditions(fields, query, 1)

        assert "LOWER(s.name)" in where_clause
        assert len(params) > 0

    def test_build_fuzzy_conditions_parameter_indexing(self) -> None:
        """Test build_fuzzy_conditions parameter indexing."""
        from app.utils.search import build_fuzzy_conditions

        fields = ["s.name"]
        query = "test"

        where_clause, params, next_idx = build_fuzzy_conditions(fields, query, 5)

        # Should start parameter indexing at 5
        assert "$5" in where_clause
        assert next_idx > 5

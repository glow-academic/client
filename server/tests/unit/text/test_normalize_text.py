"""
Tests for app.utils.text.normalize_text
"""

import pytest


class TestNormalize_Text:
    """Tests for normalize_text function."""

    def test_normalize_text_success(self) -> None:
        """Test successful normalize_text execution."""
        from app.utils.text.normalize_text import normalize_text

        # Test basic normalization
        result = normalize_text("Hello World")
        assert result == "hello world"

    def test_normalize_text_accents(self) -> None:
        """Test normalize_text with accents."""
        from app.utils.text.normalize_text import normalize_text

        # Test accent removal
        result = normalize_text("Café résumé")
        assert result == "cafe resume"

    def test_normalize_text_whitespace(self) -> None:
        """Test normalize_text with multiple whitespace."""
        from app.utils.text.normalize_text import normalize_text

        # Test whitespace collapse
        result = normalize_text("Hello    World  \n\t  Test")
        assert result == "hello world test"

    def test_normalize_text_none(self) -> None:
        """Test normalize_text with None input."""
        from app.utils.text.normalize_text import normalize_text

        # Test None handling
        result = normalize_text(None)
        assert result == ""

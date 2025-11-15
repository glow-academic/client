"""
Tests for app.utils.mime.get_content_type
"""

import pytest


class TestGet_Content_Type:
    """Tests for get_content_type function."""

    def test_get_content_type_with_valid_mime(self) -> None:
        """Test get_content_type with valid mime_type."""
        from app.utils.mime.get_content_type import get_content_type

        result = get_content_type("document.pdf", "application/pdf")
        assert result == "application/pdf"

    def test_get_content_type_with_generic_mime(self) -> None:
        """Test get_content_type with generic mime_type."""
        from app.utils.mime.get_content_type import get_content_type

        # Should infer from filename when mime is generic
        result = get_content_type("script.py", "application/octet-stream")
        # Python's mimetypes returns this (or our override if mimetypes fails)
        assert result in ["text/x-python", "text/x-python; charset=utf-8"]

    def test_get_content_type_without_mime(self) -> None:
        """Test get_content_type without mime_type."""
        from app.utils.mime.get_content_type import get_content_type

        result = get_content_type("document.pdf", None)
        assert result == "application/pdf"

    def test_get_content_type_override_generic(self) -> None:
        """Test get_content_type overrides generic mime."""
        from app.utils.mime.get_content_type import get_content_type

        # Should infer from filename when stored mime is generic
        result = get_content_type("photo.png", "application/octet-stream")
        assert result == "image/png"

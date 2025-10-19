"""
Tests for app.utils.mime_utils
"""

from unittest.mock import MagicMock

import pytest
from app.utils.mime_utils import *  # type: ignore
from sqlmodel import Session


@pytest.fixture
def mock_session() -> MagicMock:
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestInfer_Mime_From_Name:
    """Tests for infer_mime_from_name function."""

    def test_infer_mime_from_name_pdf(self) -> None:
        """Test infer_mime_from_name with PDF."""
        from app.utils.mime_utils import infer_mime_from_name

        result = infer_mime_from_name("document.pdf")
        assert result == "application/pdf"

    def test_infer_mime_from_name_python(self) -> None:
        """Test infer_mime_from_name with Python file."""
        from app.utils.mime_utils import infer_mime_from_name

        result = infer_mime_from_name("script.py")
        # Python's mimetypes returns this (or our override if mimetypes fails)
        assert result in ["text/x-python", "text/x-python; charset=utf-8"]

    def test_infer_mime_from_name_javascript(self) -> None:
        """Test infer_mime_from_name with JavaScript file."""
        from app.utils.mime_utils import infer_mime_from_name

        result = infer_mime_from_name("script.js")
        # Python's mimetypes returns this (or our override if mimetypes fails)
        assert result in ["text/javascript", "text/javascript; charset=utf-8", "application/javascript"]

    def test_infer_mime_from_name_image(self) -> None:
        """Test infer_mime_from_name with image file."""
        from app.utils.mime_utils import infer_mime_from_name

        result = infer_mime_from_name("photo.png")
        assert result == "image/png"

    def test_infer_mime_from_name_no_extension(self) -> None:
        """Test infer_mime_from_name with no extension."""
        from app.utils.mime_utils import infer_mime_from_name

        result = infer_mime_from_name("noextension")
        assert result == "application/octet-stream"

    def test_infer_mime_from_name_empty(self) -> None:
        """Test infer_mime_from_name with empty string."""
        from app.utils.mime_utils import infer_mime_from_name

        result = infer_mime_from_name("")
        assert result == "application/octet-stream"

    def test_infer_mime_from_name_case_insensitive(self) -> None:
        """Test infer_mime_from_name is case insensitive."""
        from app.utils.mime_utils import infer_mime_from_name

        result = infer_mime_from_name("DOCUMENT.PDF")
        assert result == "application/pdf"


class TestGet_Content_Type:
    """Tests for get_content_type function."""

    def test_get_content_type_with_valid_mime(self) -> None:
        """Test get_content_type with valid mime_type."""
        from app.utils.mime_utils import get_content_type

        result = get_content_type("document.pdf", "application/pdf")
        assert result == "application/pdf"

    def test_get_content_type_with_generic_mime(self) -> None:
        """Test get_content_type with generic mime_type."""
        from app.utils.mime_utils import get_content_type

        # Should infer from filename when mime is generic
        result = get_content_type("script.py", "application/octet-stream")
        # Python's mimetypes returns this (or our override if mimetypes fails)
        assert result in ["text/x-python", "text/x-python; charset=utf-8"]

    def test_get_content_type_without_mime(self) -> None:
        """Test get_content_type without mime_type."""
        from app.utils.mime_utils import get_content_type

        result = get_content_type("document.pdf", None)
        assert result == "application/pdf"

    def test_get_content_type_override_generic(self) -> None:
        """Test get_content_type overrides generic mime."""
        from app.utils.mime_utils import get_content_type

        # Should infer from filename when stored mime is generic
        result = get_content_type("photo.png", "application/octet-stream")
        assert result == "image/png"

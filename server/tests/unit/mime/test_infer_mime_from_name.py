"""
Tests for app.utils.mime.infer_mime_from_name
"""


class TestInfer_Mime_From_Name:
    """Tests for infer_mime_from_name function."""

    def test_infer_mime_from_name_pdf(self) -> None:
        """Test infer_mime_from_name with PDF."""
        from utils.mime.infer_mime_from_name import infer_mime_from_name

        result = infer_mime_from_name("document.pdf")
        assert result == "application/pdf"

    def test_infer_mime_from_name_python(self) -> None:
        """Test infer_mime_from_name with Python file."""
        from utils.mime.infer_mime_from_name import infer_mime_from_name

        result = infer_mime_from_name("script.py")
        # Python's mimetypes returns this (or our override if mimetypes fails)
        assert result in ["text/x-python", "text/x-python; charset=utf-8"]

    def test_infer_mime_from_name_javascript(self) -> None:
        """Test infer_mime_from_name with JavaScript file."""
        from utils.mime.infer_mime_from_name import infer_mime_from_name

        result = infer_mime_from_name("script.js")
        # Python's mimetypes returns this (or our override if mimetypes fails)
        assert result in [
            "text/javascript",
            "text/javascript; charset=utf-8",
            "application/javascript",
        ]

    def test_infer_mime_from_name_image(self) -> None:
        """Test infer_mime_from_name with image file."""
        from utils.mime.infer_mime_from_name import infer_mime_from_name

        result = infer_mime_from_name("photo.png")
        assert result == "image/png"

    def test_infer_mime_from_name_no_extension(self) -> None:
        """Test infer_mime_from_name with no extension."""
        from utils.mime.infer_mime_from_name import infer_mime_from_name

        result = infer_mime_from_name("noextension")
        assert result == "application/octet-stream"

    def test_infer_mime_from_name_empty(self) -> None:
        """Test infer_mime_from_name with empty string."""
        from utils.mime.infer_mime_from_name import infer_mime_from_name

        result = infer_mime_from_name("")
        assert result == "application/octet-stream"

    def test_infer_mime_from_name_case_insensitive(self) -> None:
        """Test infer_mime_from_name is case insensitive."""
        from utils.mime.infer_mime_from_name import infer_mime_from_name

        result = infer_mime_from_name("DOCUMENT.PDF")
        assert result == "application/pdf"

"""
Tests for app.utils.document.read_pdf_text_pages
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestRead_Pdf_Text_Pages:
    """Tests for read_pdf_text_pages function."""

    def test_read_pdf_text_pages_success(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading PDF text pages successfully."""
        # Create a minimal PDF-like file (we'll mock pypdf)
        test_file = tmp_path / "test.pdf"
        test_file.write_bytes(b"fake pdf content")

        # Mock pypdf.PdfReader
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page 1 content"
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page 2 content"
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page1, mock_page2]

        from app.utils.document.read_pdf_text_pages import read_pdf_text_pages

        with patch(
            "app.utils.document.read_pdf_text_pages.pypdf.PdfReader",
            return_value=mock_reader,
        ):
            result = read_pdf_text_pages(str(test_file))

            assert len(result) == 2
            assert result[0] == "Page 1 content"
            assert result[1] == "Page 2 content"

    def test_read_pdf_text_pages_empty_pdf(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading empty PDF."""
        test_file = tmp_path / "empty.pdf"
        test_file.write_bytes(b"fake pdf content")

        mock_reader = MagicMock()
        mock_reader.pages = []

        from app.utils.document.read_pdf_text_pages import read_pdf_text_pages

        with patch(
            "app.utils.document.read_pdf_text_pages.pypdf.PdfReader",
            return_value=mock_reader,
        ):
            result = read_pdf_text_pages(str(test_file))

            assert result == []

    def test_read_pdf_text_pages_error_handling(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test read_pdf_text_pages error handling."""
        test_file = tmp_path / "nonexistent.pdf"

        from app.utils.document.read_pdf_text_pages import read_pdf_text_pages

        with pytest.raises(ValueError, match="Error reading PDF file"):
            read_pdf_text_pages(str(test_file))

    def test_read_pdf_text_pages_empty_text(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading PDF with empty text pages."""
        test_file = tmp_path / "test.pdf"
        test_file.write_bytes(b"fake pdf content")

        mock_page = MagicMock()
        mock_page.extract_text.return_value = None
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]

        from app.utils.document.read_pdf_text_pages import read_pdf_text_pages

        with patch(
            "app.utils.document.read_pdf_text_pages.pypdf.PdfReader",
            return_value=mock_reader,
        ):
            result = read_pdf_text_pages(str(test_file))

            assert len(result) == 1
            assert result[0] == ""  # Should strip empty string

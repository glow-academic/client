"""
Tests for app.utils.text.read_document_content_for_similarity
"""

from pathlib import Path

import pytest


class TestRead_Document_Content_For_Similarity:
    """Tests for read_document_content_for_similarity function."""

    def test_read_document_content_for_similarity_text_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading text file."""
        from app.utils.text.read_document_content_for_similarity import (
            read_document_content_for_similarity,
        )

        # Create a temporary text file
        test_file = tmp_path / "test.txt"
        test_file.write_text("Hello World Test Content")

        # Mock UPLOAD_FOLDER to use tmp_path - patch where it's imported
        monkeypatch.setattr(
            "app.utils.text.read_document_content_for_similarity.UPLOAD_FOLDER",
            tmp_path,
        )

        result = read_document_content_for_similarity("test.txt")
        assert result == "Hello World Test Content"

    def test_read_document_content_for_similarity_nonexistent_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading non-existent file."""
        from app.utils.text.read_document_content_for_similarity import (
            read_document_content_for_similarity,
        )

        # Mock UPLOAD_FOLDER to use tmp_path - patch where it's imported
        monkeypatch.setattr(
            "app.utils.text.read_document_content_for_similarity.UPLOAD_FOLDER",
            tmp_path,
        )

        result = read_document_content_for_similarity("nonexistent.txt")
        assert result == ""

    def test_read_document_content_for_similarity_latin1_fallback(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading file with latin-1 encoding fallback."""
        from app.utils.text.read_document_content_for_similarity import (
            read_document_content_for_similarity,
        )

        # Create a file with latin-1 encoding
        test_file = tmp_path / "latin1.txt"
        test_file.write_bytes(b"Hello \xe9 World")  # latin-1 encoded é

        # Mock UPLOAD_FOLDER to use tmp_path - patch where it's imported
        monkeypatch.setattr(
            "app.utils.text.read_document_content_for_similarity.UPLOAD_FOLDER",
            tmp_path,
        )

        result = read_document_content_for_similarity("latin1.txt")
        # Should successfully read with latin-1 fallback
        assert "Hello" in result
        assert "World" in result

    def test_read_document_content_for_similarity_pdf(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading PDF file."""
        from unittest.mock import MagicMock, patch

        from app.utils.text.read_document_content_for_similarity import (
            read_document_content_for_similarity,
        )

        # Create a fake PDF file
        test_file = tmp_path / "test.pdf"
        test_file.write_bytes(b"fake pdf content")

        # Mock UPLOAD_FOLDER to use tmp_path
        monkeypatch.setattr(
            "app.utils.text.read_document_content_for_similarity.UPLOAD_FOLDER",
            tmp_path,
        )

        # Mock pypdf.PdfReader
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = "Page 1 content"
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "Page 2 content"
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page1, mock_page2]

        with patch("pypdf.PdfReader", return_value=mock_reader):
            result = read_document_content_for_similarity("test.pdf")

            assert "Page 1 content" in result
            assert "Page 2 content" in result

    def test_read_document_content_for_similarity_pdf_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test reading PDF file with error."""
        from app.utils.text.read_document_content_for_similarity import (
            read_document_content_for_similarity,
        )

        # Create a fake PDF file
        test_file = tmp_path / "test.pdf"
        test_file.write_bytes(b"fake pdf content")

        # Mock UPLOAD_FOLDER to use tmp_path
        monkeypatch.setattr(
            "app.utils.text.read_document_content_for_similarity.UPLOAD_FOLDER",
            tmp_path,
        )

        # Mock pypdf.PdfReader to raise an exception
        from unittest.mock import patch

        with patch("pypdf.PdfReader", side_effect=Exception("PDF error")):
            result = read_document_content_for_similarity("test.pdf")

            # Should return empty string on error
            assert result == ""

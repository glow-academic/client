"""
Tests for app.utils.document.format_document_info
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestFormat_Document_Info:
    """Tests for format_document_info function."""

    def test_format_document_info_empty_list(self) -> None:
        """Test format_document_info with empty document list."""
        from app.infra.v4.documents.format_document_info import format_document_info

        result = format_document_info([])

        assert result["role"] == "user"
        assert isinstance(result["content"], list)
        assert len(result["content"]) == 1
        assert result["content"][0]["type"] == "input_text"
        assert "No documents provided" in result["content"][0]["text"]

    def test_format_document_info_text_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test format_document_info with text file."""
        from app.infra.v4.documents.format_document_info import format_document_info

        # Create a temporary text file
        test_file = tmp_path / "test.txt"
        test_file.write_text("Test Content")

        # Mock UPLOAD_FOLDER
        monkeypatch.setattr(
            "app.infra.v4.documents.format_document_info.UPLOAD_FOLDER", tmp_path
        )

        documents = [
            {
                "id": "123",
                "name": "Test Document",
                "file_path": "test.txt",
                "mime_type": "text/plain",
            }
        ]

        result = format_document_info(documents, show_images=False)

        assert result["role"] == "user"
        assert isinstance(result["content"], list)
        assert len(result["content"]) > 0

        # Check that text content is included
        text_content = [
            item for item in result["content"] if item["type"] == "input_text"
        ]
        assert len(text_content) > 0
        assert "Test Document" in text_content[0]["text"]
        assert "Test Content" in text_content[0]["text"]

    def test_format_document_info_pdf(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test format_document_info with PDF file."""
        from app.infra.v4.documents.format_document_info import format_document_info

        test_file = tmp_path / "test.pdf"
        test_file.write_bytes(b"fake pdf content")

        monkeypatch.setattr(
            "app.infra.v4.documents.format_document_info.UPLOAD_FOLDER", tmp_path
        )

        # Mock pypdf
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "PDF Page Content"
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]

        documents = [
            {
                "id": "123",
                "name": "Test PDF",
                "file_path": "test.pdf",
                "mime_type": "application/pdf",
            }
        ]

        with (
            patch("pypdf.PdfReader", return_value=mock_reader),
            patch(
                "app.infra.v4.documents.format_document_info.pdf_pages_to_image_data_urls",
                return_value=[],
            ),
        ):
            result = format_document_info(documents, show_images=False)

            assert result["role"] == "user"
            assert isinstance(result["content"], list)
            assert len(result["content"]) > 0
            assert "Test PDF" in result["content"][0]["text"]
            assert "PDF Page Content" in result["content"][0]["text"]

    def test_format_document_info_pdf_with_images(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test format_document_info with PDF and images enabled."""
        from app.infra.v4.documents.format_document_info import format_document_info

        test_file = tmp_path / "test.pdf"
        test_file.write_bytes(b"fake pdf content")

        monkeypatch.setattr(
            "app.infra.v4.documents.format_document_info.UPLOAD_FOLDER", tmp_path
        )

        # Mock pypdf
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "PDF Page Content"
        mock_reader = MagicMock()
        mock_reader.pages = [mock_page]

        # Mock image URLs
        image_urls = ["data:image/png;base64,dGVzdA=="]

        documents = [
            {
                "id": "123",
                "name": "Test PDF",
                "file_path": "test.pdf",
                "mime_type": "application/pdf",
            }
        ]

        with (
            patch("pypdf.PdfReader", return_value=mock_reader),
            patch(
                "app.infra.v4.documents.format_document_info.pdf_pages_to_image_data_urls",
                return_value=image_urls,
            ),
        ):
            result = format_document_info(documents, show_images=True)

            assert result["role"] == "user"
            assert isinstance(result["content"], list)
            # Should have image item followed by text item
            assert result["content"][0]["type"] == "input_image"
            assert result["content"][1]["type"] == "input_text"

    def test_format_document_info_image_file(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test format_document_info with image file."""
        from app.infra.v4.documents.format_document_info import format_document_info

        # Create a fake image file (valid PNG header)
        test_file = tmp_path / "test.png"
        # Write a minimal valid PNG file
        png_header = b"\x89PNG\r\n\x1a\n"
        test_file.write_bytes(png_header + b"fake png content")

        monkeypatch.setattr(
            "app.infra.v4.documents.format_document_info.UPLOAD_FOLDER", tmp_path
        )

        documents = [
            {
                "id": "123",
                "name": "Test Image",
                "file_path": "test.png",
                "mime_type": "image/png",
            }
        ]

        result = format_document_info(documents, show_images=True)

        assert result["role"] == "user"
        assert isinstance(result["content"], list)
        assert len(result["content"]) > 0
        # Check if we got an image or if it failed and fell back
        if result["content"][0]["type"] == "input_image":
            assert result["content"][0]["image_url"].startswith(
                "data:image/png;base64,"
            )
        else:
            # If reading failed, it would fall back to "No documents provided"
            assert "No documents provided" in result["content"][0]["text"]

    def test_format_document_info_image_file_no_images(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test format_document_info with image file but show_images=False."""
        from app.infra.v4.documents.format_document_info import format_document_info

        test_file = tmp_path / "test.png"
        test_file.write_bytes(b"fake png content")

        monkeypatch.setattr(
            "app.infra.v4.documents.format_document_info.UPLOAD_FOLDER", tmp_path
        )

        documents = [
            {
                "id": "123",
                "name": "Test Image",
                "file_path": "test.png",
                "mime_type": "image/png",
            }
        ]

        result = format_document_info(documents, show_images=False)

        # When show_images=False, image files should add nothing
        assert result["role"] == "user"
        # Should have fallback "No documents provided" since no content was added
        assert len(result["content"]) == 1
        assert result["content"][0]["type"] == "input_text"
        assert "No documents provided" in result["content"][0]["text"]

    def test_format_document_info_missing_document(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test format_document_info with missing document file."""
        from app.infra.v4.documents.format_document_info import format_document_info

        monkeypatch.setattr(
            "app.infra.v4.documents.format_document_info.UPLOAD_FOLDER", tmp_path
        )

        documents = [
            {
                "id": "123",
                "name": "Missing File",
                "file_path": "nonexistent.txt",
                "mime_type": "text/plain",
            }
        ]

        # Should handle missing file gracefully - read_text_file raises ValueError
        with pytest.raises(ValueError, match="Error reading file"):
            format_document_info(documents, show_images=False)

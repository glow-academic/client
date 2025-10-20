"""
Tests for app.utils.document
"""

from pathlib import Path

import pytest


class TestFormat_Document_Info:
    """Tests for format_document_info function."""

    def test_format_document_info_empty_list(self) -> None:
        """Test format_document_info with empty document list."""
        from app.utils.document import format_document_info  # type: ignore

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
        from app.utils.document import format_document_info  # type: ignore

        # Create a temporary text file
        test_file = tmp_path / "test.txt"
        test_file.write_text("Test Content")

        # Mock UPLOAD_FOLDER
        monkeypatch.setattr("app.utils.document.UPLOAD_FOLDER", str(tmp_path))

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

    @pytest.mark.skip(
        reason="PDF/image handling requires complex mocking and file setup"
    )
    def test_format_document_info_pdf(self) -> None:
        """Test format_document_info with PDF file."""
        # This would require creating a valid PDF file and mocking pypdf
        pass

    @pytest.mark.skip(reason="Image handling requires complex file setup")
    def test_format_document_info_image(self) -> None:
        """Test format_document_info with image file."""
        # This would require creating a valid image file
        pass

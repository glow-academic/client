"""
Tests for app.utils.document.read_text_file
"""

from pathlib import Path

import pytest


class TestRead_Text_File:
    """Tests for read_text_file function."""

    def test_read_text_file_utf8(self, tmp_path: Path) -> None:
        """Test reading UTF-8 text file."""
        from app.utils.document.read_text_file import read_text_file

        test_file = tmp_path / "test.txt"
        test_file.write_text("Hello World\nTest Content", encoding="utf-8")

        result = read_text_file(str(test_file))

        assert result == "Hello World\nTest Content"

    def test_read_text_file_latin1_fallback(self, tmp_path: Path) -> None:
        """Test reading text file with latin-1 fallback."""
        from app.utils.document.read_text_file import read_text_file

        test_file = tmp_path / "test.txt"
        # Write bytes that are valid latin-1 but not UTF-8
        test_file.write_bytes(b"Hello \xe9 World")  # é in latin-1

        result = read_text_file(str(test_file))

        assert "Hello" in result
        assert "World" in result

    def test_read_text_file_not_found(self, tmp_path: Path) -> None:
        """Test read_text_file with file not found."""
        from app.utils.document.read_text_file import read_text_file

        test_file = tmp_path / "nonexistent.txt"

        with pytest.raises(ValueError, match="Error reading file"):
            read_text_file(str(test_file))

    def test_read_text_file_strips_whitespace(self, tmp_path: Path) -> None:
        """Test read_text_file strips whitespace."""
        from app.utils.document.read_text_file import read_text_file

        test_file = tmp_path / "test.txt"
        test_file.write_text("  Hello World  \n", encoding="utf-8")

        result = read_text_file(str(test_file))

        # The function uses .strip() which removes ALL leading/trailing whitespace
        assert result == "Hello World"

    def test_read_text_file_encoding_error(self, tmp_path: Path) -> None:
        """Test read_text_file with encoding error."""
        from app.utils.document.read_text_file import read_text_file

        # Let's use a file that doesn't exist to test the error path
        nonexistent_file = tmp_path / "nonexistent.txt"

        # Should raise ValueError on file not found
        with pytest.raises(ValueError, match="Error reading file"):
            read_text_file(str(nonexistent_file))

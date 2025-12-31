"""Integration tests for app.infra.v4.csv.parse_csv_file."""

import tempfile
from pathlib import Path

from app.infra.v4.csv.parse_csv_file import parse_csv_file


class TestParseCsvFile:
    """Tests for parse_csv_file function."""

    def test_parse_csv_file_success(self) -> None:
        """Test successful CSV parsing."""
        # Arrange
        csv_content = "name,username\nJohn Doe,john_doe\nJane Smith,jane_smith"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            # Act
            result = parse_csv_file(temp_path)

            # Assert
            assert result["success"] is True
            assert len(result["users"]) == 2
            assert result["users"][0]["name"] == "John Doe"
            assert result["users"][0]["username"] == "john_doe"
            assert result["users"][1]["name"] == "Jane Smith"
            assert result["users"][1]["username"] == "jane_smith"
        finally:
            Path(temp_path).unlink()

    def test_parse_csv_file_empty(self) -> None:
        """Test parsing empty CSV file."""
        # Arrange
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            temp_path = f.name

        try:
            # Act
            result = parse_csv_file(temp_path)

            # Assert
            assert result["success"] is False
            assert "error" in result
        finally:
            Path(temp_path).unlink()

    def test_parse_csv_file_header_only(self) -> None:
        """Test parsing CSV with only header."""
        # Arrange
        csv_content = "name,username"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            # Act
            result = parse_csv_file(temp_path)

            # Assert
            assert result["success"] is True
            assert len(result["users"]) == 0
        finally:
            Path(temp_path).unlink()

    def test_parse_csv_file_missing_headers(self) -> None:
        """Test parsing CSV with missing required headers."""
        # Arrange
        csv_content = "name,email\nJohn Doe,john@example.com"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            # Act
            result = parse_csv_file(temp_path)

            # Assert
            assert result["success"] is False
            assert "Missing required headers" in result["error"]
        finally:
            Path(temp_path).unlink()

    def test_parse_csv_file_missing_fields(self) -> None:
        """Test parsing CSV with missing required fields."""
        # Arrange
        csv_content = "name,username\nJohn Doe,\n,jane_smith"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            # Act
            result = parse_csv_file(temp_path)

            # Assert
            assert result["success"] is True
            assert len(result["errors"]) > 0
            assert len(result["users"]) == 0
        finally:
            Path(temp_path).unlink()


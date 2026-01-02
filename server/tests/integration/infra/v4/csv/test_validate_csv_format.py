"""Integration tests for app.infra.v4.csv.validate_csv_format."""

import tempfile
from pathlib import Path

from app.infra.v4.csv.validate_csv_format import validate_csv_format


class TestValidateCsvFormat:
    """Tests for validate_csv_format function."""

    def test_validate_csv_format_success(self) -> None:
        """Test successful CSV format validation."""
        # Arrange
        csv_content = "name,username\nJohn Doe,john_doe\nJane Smith,jane_smith"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            # Act
            result = validate_csv_format(temp_path)

            # Assert
            assert result["valid"] is True
            assert result["row_count"] == 2
            assert "name" in result["headers"]
            assert "username" in result["headers"]
        finally:
            Path(temp_path).unlink()

    def test_validate_csv_format_empty(self) -> None:
        """Test validation of empty CSV file."""
        # Arrange
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            temp_path = f.name

        try:
            # Act
            result = validate_csv_format(temp_path)

            # Assert
            assert result["valid"] is False
            assert "error" in result
        finally:
            Path(temp_path).unlink()

    def test_validate_csv_format_missing_headers(self) -> None:
        """Test validation of CSV with missing required headers."""
        # Arrange
        csv_content = "name,email\nJohn Doe,john@example.com"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            # Act
            result = validate_csv_format(temp_path)

            # Assert
            assert result["valid"] is False
            assert "Missing required headers" in result["error"]
            assert "username" in result["error"]
        finally:
            Path(temp_path).unlink()

    def test_validate_csv_format_header_only(self) -> None:
        """Test validation of CSV with only header."""
        # Arrange
        csv_content = "name,username"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            # Act
            result = validate_csv_format(temp_path)

            # Assert
            assert result["valid"] is True
            assert result["row_count"] == 0
        finally:
            Path(temp_path).unlink()

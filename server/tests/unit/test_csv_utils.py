"""
Tests for app.utils.csv
"""

from pathlib import Path

from app.utils.csv import parse_csv_file, validate_csv_format  # type: ignore


class TestParse_Csv_File:
    """Tests for parse_csv_file function."""

    def test_parse_csv_file_success(self, tmp_path: Path) -> None:
        """Test successful parse_csv_file execution."""
        # Create a temporary CSV file
        csv_content = "name,username\nJohn Doe,john_doe\nJane Smith,jane_smith"
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text(csv_content)

        result = parse_csv_file(str(csv_file))

        assert result["success"] is True
        assert len(result["users"]) == 2
        assert len(result["errors"]) == 0
        assert result["users"][0]["name"] == "John Doe"
        assert result["users"][0]["username"] == "john_doe"
        assert result["users"][1]["name"] == "Jane Smith"
        assert result["users"][1]["username"] == "jane_smith"

    def test_parse_csv_file_missing_headers(self, tmp_path: Path) -> None:
        """Test parse_csv_file with missing required headers."""
        # Create a CSV file with missing headers
        csv_content = "name\nJohn Doe\nJane Smith"
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text(csv_content)

        result = parse_csv_file(str(csv_file))

        assert result["success"] is False
        assert "Missing required headers" in result["error"]
        assert "username" in result["error"]

    def test_parse_csv_file_empty_fields(self, tmp_path: Path) -> None:
        """Test parse_csv_file with empty required fields."""
        # Create a CSV file with empty fields
        csv_content = "name,username\nJohn Doe,john_doe\n,\nJane Smith,jane_smith"
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text(csv_content)

        result = parse_csv_file(str(csv_file))

        assert result["success"] is True
        assert len(result["users"]) == 2  # Only valid rows
        assert len(result["errors"]) == 1  # One error for empty fields
        assert "Row 3" in result["errors"][0]

    def test_parse_csv_file_nonexistent_file(self) -> None:
        """Test parse_csv_file error handling with non-existent file."""
        result = parse_csv_file("non_existent_file.csv")

        assert result["success"] is False
        assert "Failed to parse CSV file" in result["error"]


class TestValidate_Csv_Format:
    """Tests for validate_csv_format function."""

    def test_validate_csv_format_success(self, tmp_path: Path) -> None:
        """Test successful validate_csv_format execution."""
        # Create a temporary CSV file
        csv_content = "name,username\nJohn Doe,john_doe\nJane Smith,jane_smith"
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text(csv_content)

        result = validate_csv_format(str(csv_file))

        assert result["valid"] is True
        assert result["row_count"] == 2
        assert "name" in result["headers"]
        assert "username" in result["headers"]

    def test_validate_csv_format_error(self, tmp_path: Path) -> None:
        """Test validate_csv_format error handling."""
        # Test with non-existent file
        result = validate_csv_format("non_existent_file.csv")

        assert result["valid"] is False
        assert "Failed to validate CSV file" in result["error"]

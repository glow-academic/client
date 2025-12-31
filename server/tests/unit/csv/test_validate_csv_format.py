"""
Tests for app.utils.csv.validate_csv_format
"""

from pathlib import Path

from app.infra.v4.csv.validate_csv_format import validate_csv_format


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

"""
Tests for app.utils.agents.tools.create_safe_field_name
"""

from app.utils.agents.tools.create_safe_field_name import create_safe_field_name


class TestCreate_Safe_Field_Name:
    """Tests for create_safe_field_name function."""

    def test_create_safe_field_name_simple(self) -> None:
        """Test with simple name."""
        result = create_safe_field_name("Communication")
        assert result == "communication"

    def test_create_safe_field_name_with_spaces(self) -> None:
        """Test with spaces."""
        result = create_safe_field_name("Problem Solving")
        assert result == "problem_solving"

    def test_create_safe_field_name_with_special_chars(self) -> None:
        """Test with special characters."""
        result = create_safe_field_name("Test-Name (Special)")
        assert result == "test_name_special"

    def test_create_safe_field_name_multiple_underscores(self) -> None:
        """Test that multiple underscores are collapsed."""
        result = create_safe_field_name("Test___Name")
        assert result == "test_name"

    def test_create_safe_field_name_leading_trailing_underscores(self) -> None:
        """Test that leading/trailing underscores are removed."""
        result = create_safe_field_name("_Test_Name_")
        assert result == "test_name"

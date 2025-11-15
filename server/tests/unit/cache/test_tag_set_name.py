"""
Tests for app.utils.cache.tag_set_name
"""

from app.utils.cache.tag_set_name import tag_set_name


class TestTag_Set_Name:
    """Tests for tag_set_name function."""

    def test_tag_set_name_success(self) -> None:
        """Test successful tag_set_name execution."""
        tag = "test_tag"
        result = tag_set_name(tag)

        assert isinstance(result, str)
        assert result == "http:tag:test_tag"

    def test_tag_set_name_empty(self) -> None:
        """Test tag_set_name with empty tag."""
        result = tag_set_name("")
        assert result == "http:tag:"


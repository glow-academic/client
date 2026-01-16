"""
Tests for app.utils.sql_helper
"""

import pytest
from app.utils.sql_helper import load_sql


class TestLoad_Sql:
    """Tests for load_sql function."""

    def test_load_sql_success(self) -> None:
        """Test successful load_sql execution."""
        # Test with a known SQL file
        sql_content = load_sql("app/sql/v3/profile/get_profile.sql")
        assert isinstance(sql_content, str)
        assert len(sql_content) > 0

    def test_load_sql_returns_string(self) -> None:
        """Test that load_sql returns a string."""
        sql_content = load_sql("app/sql/v3/profile/get_profile.sql")
        assert isinstance(sql_content, str)

    def test_load_sql_file_not_found(self) -> None:
        """Test load_sql error handling with non-existent file."""
        with pytest.raises(FileNotFoundError):
            load_sql("app/sql/v3/nonexistent/file.sql")

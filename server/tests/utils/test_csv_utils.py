"""
Tests for app.utils.csv
"""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from app.utils.csv import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest


class TestProcess_Csv_File:
    """Tests for process_csv_file function."""

    def test_process_csv_file_success(self, mock_session, tmp_path):
        """Test successful process_csv_file execution."""
        import tempfile

        from app.utils.csv import process_csv_file

        # Create a temporary CSV file
        csv_content = "name,username\nJohn Doe,john_doe\nJane Smith,jane_smith"
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text(csv_content)
        
        # Mock the database query to return no existing users
        mock_session.exec.return_value.first.return_value = None
        
        result = process_csv_file(str(csv_file), mock_session)
        
        assert result["success"] is True
        assert result["users_created"] == 2
        assert result["users_skipped"] == 0
        assert len(result["errors"]) == 0
        assert len(result["created_users"]) == 2
        assert result["created_users"][0]["name"] == "John Doe"
        assert result["created_users"][0]["username"] == "john_doe"
        
        # Verify session methods were called
        mock_session.add.assert_called()
        mock_session.commit.assert_called()

    def test_process_csv_file_error(self, mock_session, tmp_path):
        """Test process_csv_file error handling."""
        from app.utils.csv import process_csv_file

        # Test with non-existent file
        result = process_csv_file("non_existent_file.csv", mock_session)
        
        assert result["success"] is False
        assert "Failed to process CSV file" in result["error"]
        assert result["users_created"] == 0
        assert result["users_skipped"] == 0


import pytest


class TestValidate_Csv_Format:
    """Tests for validate_csv_format function."""

    def test_validate_csv_format_success(self, tmp_path):
        """Test successful validate_csv_format execution."""
        from app.utils.csv import validate_csv_format

        # Create a temporary CSV file
        csv_content = "name,username\nJohn Doe,john_doe\nJane Smith,jane_smith"
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text(csv_content)
        
        result = validate_csv_format(str(csv_file))
        
        assert result["valid"] is True
        assert result["row_count"] == 2
        assert "name" in result["headers"]
        assert "username" in result["headers"]

    def test_validate_csv_format_error(self, tmp_path):
        """Test validate_csv_format error handling."""
        from app.utils.csv import validate_csv_format

        # Test with non-existent file
        result = validate_csv_format("non_existent_file.csv")
        
        assert result["valid"] is False
        assert "Failed to validate CSV file" in result["error"]


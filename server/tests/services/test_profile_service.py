"""
Tests for app.services.profile_service
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.services.profile_service import ProfileService


class MockRow:
    """Mock database row that supports both dict() and attribute access."""

    def __init__(self, **kwargs):
        self._data = kwargs

    def __getitem__(self, key):
        return self._data[key]

    def get(self, key, default=None):
        return self._data.get(key, default)

    def keys(self):
        return self._data.keys()

    def values(self):
        return self._data.values()

    def items(self):
        return self._data.items()

    def __iter__(self):
        return iter(self._data)


@pytest.fixture
def mock_conn():
    """Create a mock database connection."""
    conn = AsyncMock()
    # Mock transaction context manager
    conn.transaction.return_value.__aenter__ = AsyncMock()
    conn.transaction.return_value.__aexit__ = AsyncMock()
    return conn


class TestCreateProfilesFromCsv:
    """Tests for create_profiles_from_csv method."""

    @patch("app.services.profile_service.parse_csv_file")
    async def test_create_profiles_from_csv_success(self, mock_parse_csv, mock_conn, tmp_path):
        """Test successful CSV processing and profile creation."""
        # Mock parse_csv_file to return valid data
        mock_parse_csv.return_value = {
            "success": True,
            "users": [
                {"name": "John Doe", "username": "john_doe", "row_num": 2},
                {"name": "Jane Smith", "username": "jane_smith", "row_num": 3},
            ],
            "errors": [],
        }

        # Mock database queries - no existing users
        mock_conn.fetchrow.return_value = None
        mock_conn.execute.return_value = None

        # Create service and call method
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text("name,username\nJohn Doe,john_doe\nJane Smith,jane_smith")

        service = ProfileService(mock_conn)
        result = await service.create_profiles_from_csv(str(csv_file))

        # Assertions
        assert result["success"] is True
        assert result["users_created"] == 2
        assert result["users_skipped"] == 0
        assert len(result["created_users"]) == 2
        assert result["created_users"][0]["name"] == "John Doe"
        assert result["created_users"][1]["name"] == "Jane Smith"

        # Verify parse_csv_file was called
        mock_parse_csv.assert_called_once_with(str(csv_file))

        # Verify database operations were called (2 checks + 2 inserts = 4 total)
        assert mock_conn.fetchrow.call_count == 2
        assert mock_conn.execute.call_count == 2

    @patch("app.services.profile_service.parse_csv_file")
    async def test_create_profiles_from_csv_skip_existing(self, mock_parse_csv, mock_conn, tmp_path):
        """Test skipping existing users."""
        # Mock parse_csv_file
        mock_parse_csv.return_value = {
            "success": True,
            "users": [
                {"name": "John Doe", "username": "john_doe", "row_num": 2},
                {"name": "Jane Smith", "username": "jane_smith", "row_num": 3},
            ],
            "errors": [],
        }

        # Mock database queries - first user exists, second doesn't
        mock_conn.fetchrow.side_effect = [
            MockRow(id="existing-id"),  # john_doe exists
            None,  # jane_smith doesn't exist
        ]
        mock_conn.execute.return_value = None

        # Create service and call method
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text("name,username\nJohn Doe,john_doe\nJane Smith,jane_smith")

        service = ProfileService(mock_conn)
        result = await service.create_profiles_from_csv(str(csv_file))

        # Assertions
        assert result["success"] is True
        assert result["users_created"] == 1
        assert result["users_skipped"] == 1
        assert len(result["created_users"]) == 1
        assert result["created_users"][0]["name"] == "Jane Smith"
        assert len(result["skipped_users"]) == 1
        assert result["skipped_users"][0]["username"] == "john_doe"

    @patch("app.services.profile_service.parse_csv_file")
    async def test_create_profiles_from_csv_parse_error(self, mock_parse_csv, mock_conn, tmp_path):
        """Test handling parse errors."""
        # Mock parse_csv_file to return error
        mock_parse_csv.return_value = {
            "success": False,
            "error": "Missing required headers: username",
            "users": [],
            "errors": [],
        }

        # Create service and call method
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text("name\nJohn Doe\nJane Smith")

        service = ProfileService(mock_conn)
        result = await service.create_profiles_from_csv(str(csv_file))

        # Assertions
        assert result["success"] is False
        assert "Missing required headers" in result["error"]
        assert result["users_created"] == 0

        # Verify database operations were not called
        mock_conn.fetchrow.assert_not_called()
        mock_conn.execute.assert_not_called()

    @patch("app.services.profile_service.parse_csv_file")
    async def test_create_profiles_from_csv_with_row_errors(self, mock_parse_csv, mock_conn, tmp_path):
        """Test handling row-level validation errors."""
        # Mock parse_csv_file with some errors
        mock_parse_csv.return_value = {
            "success": True,
            "users": [
                {"name": "John Doe", "username": "john_doe", "row_num": 2},
            ],
            "errors": ["Row 3: Missing required fields (name, username)"],
        }

        # Mock database queries
        mock_conn.fetchrow.return_value = None
        mock_conn.execute.return_value = None

        # Create service and call method
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text("name,username\nJohn Doe,john_doe\n,")

        service = ProfileService(mock_conn)
        result = await service.create_profiles_from_csv(str(csv_file))

        # Assertions
        assert result["success"] is True
        assert result["users_created"] == 1
        assert len(result["errors"]) == 1
        assert "Row 3" in result["errors"][0]

    @patch("app.services.profile_service.parse_csv_file")
    async def test_create_profiles_from_csv_database_error(self, mock_parse_csv, mock_conn, tmp_path):
        """Test handling database errors."""
        # Mock parse_csv_file
        mock_parse_csv.return_value = {
            "success": True,
            "users": [
                {"name": "John Doe", "username": "john_doe", "row_num": 2},
            ],
            "errors": [],
        }

        # Mock database to raise error during transaction
        mock_conn.transaction.return_value.__aenter__.side_effect = Exception("Database connection error")

        # Create service and call method
        csv_file = tmp_path / "test_users.csv"
        csv_file.write_text("name,username\nJohn Doe,john_doe")

        service = ProfileService(mock_conn)
        result = await service.create_profiles_from_csv(str(csv_file))

        # Assertions
        assert result["success"] is False
        assert "Database error" in result["error"]
        assert result["users_created"] == 0


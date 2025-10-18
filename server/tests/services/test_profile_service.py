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



import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_profile_service`")
class TestGet_Profile_Service:
    """Tests for get_profile_service function."""

    def test_get_profile_service_success(self):
        """Test successful get_profile_service execution."""
        # TODO: Implement test for get_profile_service
        assert False, "IMPLEMENT: Test for get_profile_service"

    def test_get_profile_service_error(self):
        """Test get_profile_service error handling."""
        # TODO: Implement error test for get_profile_service
        assert False, "IMPLEMENT: Error test for get_profile_service"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_profile`")
class TestGet_Profile:
    """Tests for get_profile function."""

    def test_get_profile_success(self):
        """Test successful get_profile execution."""
        # TODO: Implement test for get_profile
        assert False, "IMPLEMENT: Test for get_profile"

    def test_get_profile_error(self):
        """Test get_profile error handling."""
        # TODO: Implement error test for get_profile
        assert False, "IMPLEMENT: Error test for get_profile"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `update_profile`")
class TestUpdate_Profile:
    """Tests for update_profile function."""

    def test_update_profile_success(self):
        """Test successful update_profile execution."""
        # TODO: Implement test for update_profile
        assert False, "IMPLEMENT: Test for update_profile"

    def test_update_profile_error(self):
        """Test update_profile error handling."""
        # TODO: Implement error test for update_profile
        assert False, "IMPLEMENT: Error test for update_profile"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `mark_intro_complete`")
class TestMark_Intro_Complete:
    """Tests for mark_intro_complete function."""

    def test_mark_intro_complete_success(self):
        """Test successful mark_intro_complete execution."""
        # TODO: Implement test for mark_intro_complete
        assert False, "IMPLEMENT: Test for mark_intro_complete"

    def test_mark_intro_complete_error(self):
        """Test mark_intro_complete error handling."""
        # TODO: Implement error test for mark_intro_complete
        assert False, "IMPLEMENT: Error test for mark_intro_complete"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `mark_chat_complete`")
class TestMark_Chat_Complete:
    """Tests for mark_chat_complete function."""

    def test_mark_chat_complete_success(self):
        """Test successful mark_chat_complete execution."""
        # TODO: Implement test for mark_chat_complete
        assert False, "IMPLEMENT: Test for mark_chat_complete"

    def test_mark_chat_complete_error(self):
        """Test mark_chat_complete error handling."""
        # TODO: Implement error test for mark_chat_complete
        assert False, "IMPLEMENT: Error test for mark_chat_complete"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_default_guest_profile_id`")
class TestGet_Default_Guest_Profile_Id:
    """Tests for get_default_guest_profile_id function."""

    def test_get_default_guest_profile_id_success(self):
        """Test successful get_default_guest_profile_id execution."""
        # TODO: Implement test for get_default_guest_profile_id
        assert False, "IMPLEMENT: Test for get_default_guest_profile_id"

    def test_get_default_guest_profile_id_error(self):
        """Test get_default_guest_profile_id error handling."""
        # TODO: Implement error test for get_default_guest_profile_id
        assert False, "IMPLEMENT: Error test for get_default_guest_profile_id"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_simulatable_profiles`")
class TestGet_Simulatable_Profiles:
    """Tests for get_simulatable_profiles function."""

    def test_get_simulatable_profiles_success(self):
        """Test successful get_simulatable_profiles execution."""
        # TODO: Implement test for get_simulatable_profiles
        assert False, "IMPLEMENT: Test for get_simulatable_profiles"

    def test_get_simulatable_profiles_error(self):
        """Test get_simulatable_profiles error handling."""
        # TODO: Implement error test for get_simulatable_profiles
        assert False, "IMPLEMENT: Error test for get_simulatable_profiles"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `authorize_emulation`")
class TestAuthorize_Emulation:
    """Tests for authorize_emulation function."""

    def test_authorize_emulation_success(self):
        """Test successful authorize_emulation execution."""
        # TODO: Implement test for authorize_emulation
        assert False, "IMPLEMENT: Test for authorize_emulation"

    def test_authorize_emulation_error(self):
        """Test authorize_emulation error handling."""
        # TODO: Implement error test for authorize_emulation
        assert False, "IMPLEMENT: Error test for authorize_emulation"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_profile_context`")
class TestGet_Profile_Context:
    """Tests for get_profile_context function."""

    def test_get_profile_context_success(self):
        """Test successful get_profile_context execution."""
        # TODO: Implement test for get_profile_context
        assert False, "IMPLEMENT: Test for get_profile_context"

    def test_get_profile_context_error(self):
        """Test get_profile_context error handling."""
        # TODO: Implement error test for get_profile_context
        assert False, "IMPLEMENT: Error test for get_profile_context"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_profile_by_alias`")
class TestGet_Profile_By_Alias:
    """Tests for get_profile_by_alias function."""

    def test_get_profile_by_alias_success(self):
        """Test successful get_profile_by_alias execution."""
        # TODO: Implement test for get_profile_by_alias
        assert False, "IMPLEMENT: Test for get_profile_by_alias"

    def test_get_profile_by_alias_error(self):
        """Test get_profile_by_alias error handling."""
        # TODO: Implement error test for get_profile_by_alias
        assert False, "IMPLEMENT: Error test for get_profile_by_alias"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `create_profiles_from_csv`")
class TestCreate_Profiles_From_Csv:
    """Tests for create_profiles_from_csv function."""

    def test_create_profiles_from_csv_success(self):
        """Test successful create_profiles_from_csv execution."""
        # TODO: Implement test for create_profiles_from_csv
        assert False, "IMPLEMENT: Test for create_profiles_from_csv"

    def test_create_profiles_from_csv_error(self):
        """Test create_profiles_from_csv error handling."""
        # TODO: Implement error test for create_profiles_from_csv
        assert False, "IMPLEMENT: Error test for create_profiles_from_csv"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_student_simulation_report`")
class TestGet_Student_Simulation_Report:
    """Tests for get_student_simulation_report function."""

    def test_get_student_simulation_report_success(self):
        """Test successful get_student_simulation_report execution."""
        # TODO: Implement test for get_student_simulation_report
        assert False, "IMPLEMENT: Test for get_student_simulation_report"

    def test_get_student_simulation_report_error(self):
        """Test get_student_simulation_report error handling."""
        # TODO: Implement error test for get_student_simulation_report
        assert False, "IMPLEMENT: Error test for get_student_simulation_report"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `search_profiles`")
class TestSearch_Profiles:
    """Tests for search_profiles function."""

    def test_search_profiles_success(self):
        """Test successful search_profiles execution."""
        # TODO: Implement test for search_profiles
        assert False, "IMPLEMENT: Test for search_profiles"

    def test_search_profiles_error(self):
        """Test search_profiles error handling."""
        # TODO: Implement error test for search_profiles
        assert False, "IMPLEMENT: Error test for search_profiles"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_profile_overview`")
class TestGet_Profile_Overview:
    """Tests for get_profile_overview function."""

    def test_get_profile_overview_success(self):
        """Test successful get_profile_overview execution."""
        # TODO: Implement test for get_profile_overview
        assert False, "IMPLEMENT: Test for get_profile_overview"

    def test_get_profile_overview_error(self):
        """Test get_profile_overview error handling."""
        # TODO: Implement error test for get_profile_overview
        assert False, "IMPLEMENT: Error test for get_profile_overview"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `fetcher`")
class TestFetcher:
    """Tests for fetcher function."""

    def test_fetcher_success(self):
        """Test successful fetcher execution."""
        # TODO: Implement test for fetcher
        assert False, "IMPLEMENT: Test for fetcher"

    def test_fetcher_error(self):
        """Test fetcher error handling."""
        # TODO: Implement error test for fetcher
        assert False, "IMPLEMENT: Error test for fetcher"


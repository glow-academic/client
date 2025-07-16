# tests/services/mcp/tools/search/test_find_profiles.py

import uuid
from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.search.find_profiles import find_profiles

class MockProfile:
    def __init__(self, id, first_name, last_name, alias, role="student"):
        self.id, self.first_name, self.last_name, self.alias, self.role = id, first_name, last_name, alias, role

@patch("app.services.mcp.tools.search.find_profiles.get_session")
class TestFind_Profiles:
    """Tests for find_profiles function."""

    def test_find_profiles_by_single_name(self, mock_get_session):
        """Test successful search with a single name query."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_profile = MockProfile(uuid.uuid4(), "Jordan", "Lee", "jlee")
        mock_session.exec.return_value.all.return_value = [mock_profile]

        result = find_profiles(query="Jordan")

        assert len(result) == 1
        assert result[0]["full_name"] == "Jordan Lee"
        assert result[0]["alias"] == "jlee"

    def test_find_profiles_by_full_name(self, mock_get_session):
        """Test successful search with a full name query."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_profile = MockProfile(uuid.uuid4(), "Jordan", "Lee", "jlee")
        mock_session.exec.return_value.all.return_value = [mock_profile]

        result = find_profiles(query="Jordan Lee")

        assert len(result) == 1
        assert result[0]["id"] == str(mock_profile.id)

    def test_find_profiles_error(self, mock_get_session):
        """Test database error handling."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.side_effect = SQLAlchemyError("DB Error")

        result = find_profiles(query="Test")

        assert result == [{"error": "Database error: DB Error"}]
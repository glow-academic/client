# tests/services/mcp/tools/search/test_find_profiles.py

import uuid
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.search.find_profiles import find_profiles


class MockProfile:
    def __init__(self, id, first_name, last_name, alias, role="student"):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.alias = alias
        self.role = role


@patch("app.services.mcp.tools.search.find_profiles.get_session")
class TestFind_Profiles:
    """Tests for find_profiles function."""

    def test_find_profiles_by_single_name(self, mock_get_session):
        """Single token should match first name."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_profile = MockProfile(uuid.uuid4(), "Jordan", "Lee", "jlee")
        mock_session.exec.return_value.all.return_value = [mock_profile]

        result = find_profiles(query="Jordan")

        assert len(result) == 1
        r0 = result[0]
        assert r0["full_name"] == "Jordan Lee"
        assert r0["alias"] == "jlee"
        assert "score" in r0
        assert isinstance(r0["score"], int)
        assert r0["score"] > 0

    def test_find_profiles_by_full_name(self, mock_get_session):
        """Full name query should produce full-name match."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_profile = MockProfile(uuid.uuid4(), "Jordan", "Lee", "jlee")
        mock_session.exec.return_value.all.return_value = [mock_profile]

        result = find_profiles(query="Jordan Lee")

        assert len(result) == 1
        r0 = result[0]
        assert r0["id"] == str(mock_profile.id)
        assert r0["full_name"] == "Jordan Lee"
        assert r0["score"] >= 100  # full-name exact gets big boost

    def test_find_profiles_error(self, mock_get_session):
        """Database error handled cleanly."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.side_effect = SQLAlchemyError("DB Error")

        result = find_profiles(query="Test")

        assert result == [{"error": "Database error: DB Error"}]

    def test_find_profiles_ranking(self, mock_get_session):
        """Ensure higher-quality match ranks first."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        p_exact = MockProfile(uuid.uuid4(), "Ashok", "Saravanan", "sarava18")
        p_partial = MockProfile(uuid.uuid4(), "Ashley", "Saran", "ash_s")
        p_alias = MockProfile(
            uuid.uuid4(), None, None, "ashok_alt"
        )  # simulate alias-only row

        # Return in worst-first order to prove sort
        mock_session.exec.return_value.all.return_value = [p_alias, p_partial, p_exact]

        result = find_profiles(query="Ashok Saravanan", limit=5)

        # top should be the exact full-name match
        assert result[0]["id"] == str(p_exact.id)
        assert result[0]["score"] >= result[1]["score"] >= result[2]["score"]

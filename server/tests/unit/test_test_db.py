"""
Tests for app.utils.test_db
"""

from unittest.mock import MagicMock, patch

from app.utils.test_db import get_test_db_url


class TestGet_Test_Db_Url:
    """Tests for get_test_db_url function."""

    def test_get_test_db_url_with_container(self) -> None:
        """Test get_test_db_url with test container available."""
        mock_container = MagicMock()
        mock_container.get_connection_url.return_value = (
            "postgresql+psycopg2://user:pass@host:5432/db"
        )

        with patch("app.main._test_container", mock_container):
            result = get_test_db_url()
            assert result == "postgresql://user:pass@host:5432/db"

    def test_get_test_db_url_without_container(self) -> None:
        """Test get_test_db_url without test container."""
        with patch("app.main._test_container", None):
            result = get_test_db_url()
            assert result is None

    def test_get_test_db_url_replaces_psycopg2(self) -> None:
        """Test that get_test_db_url replaces psycopg2 in URL."""
        mock_container = MagicMock()
        mock_container.get_connection_url.return_value = (
            "postgresql+psycopg2://user:pass@host:5432/db"
        )

        with patch("app.main._test_container", mock_container):
            result = get_test_db_url()
            assert "psycopg2" not in result
            assert result.startswith("postgresql://")

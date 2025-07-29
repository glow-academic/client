"""
Tests for app.routes.csv
"""

from unittest.mock import ANY, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from app.main import app

    return TestClient(app)


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestGet_Csv:
    """Tests for get_csv endpoint."""

    @patch("app.routes.csv.FileResponse")
    @patch("app.routes.csv.os.path.exists", return_value=True)
    def test_get_csv_success(
        self, mock_exists, mock_file_response, client, mock_session
    ):
        """Test successful get_csv request."""
        token = "test-token-123"

        response = client.get(f"/csv/token/{token}")

        assert response.status_code == 200
        # Check that exists was called with the expected path
        mock_exists.assert_any_call(ANY)
        mock_file_response.assert_called_once_with(
            path=ANY, filename=f"{token}.csv", media_type="text/csv"
        )

    @patch("app.routes.csv.os.path.exists", return_value=False)
    def test_get_csv_error(self, mock_exists, client, mock_session):
        """Test get_csv error handling."""
        token = "non-existent-token"

        response = client.get(f"/csv/token/{token}")

        assert response.status_code == 404
        assert response.json()["detail"] == "CSV file not found"
        mock_exists.assert_any_call(ANY)

    @patch("app.routes.csv.FileResponse")
    @patch("app.routes.csv.os.path.exists", return_value=True)
    def test_get_csv_with_special_characters(
        self, mock_exists, mock_file_response, client, mock_session
    ):
        """Test get_csv with special characters in token."""
        token = "test-token_with-special.chars_123"

        response = client.get(f"/csv/token/{token}")

        assert response.status_code == 200
        # Check that exists was called with the expected path
        mock_exists.assert_any_call(ANY)
        mock_file_response.assert_called_once_with(
            path=ANY, filename=f"{token}.csv", media_type="text/csv"
        )

    def test_get_csv_empty_token(self, client, mock_session):
        """Test get_csv with empty token."""
        token = ""

        response = client.get(f"/csv/token/{token}")

        assert response.status_code == 404
        # The error message might be different for empty tokens
        assert "not found" in response.json()["detail"].lower()

    @patch("app.routes.csv.FileResponse")
    @patch("app.routes.csv.os.path.exists", return_value=True)
    def test_get_csv_long_token(
        self, mock_exists, mock_file_response, client, mock_session
    ):
        """Test get_csv with a long token."""
        token = "a" * 100  # 100 character token

        response = client.get(f"/csv/token/{token}")

        assert response.status_code == 200
        # Check that exists was called with the expected path
        mock_exists.assert_any_call(ANY)
        mock_file_response.assert_called_once_with(
            path=ANY, filename=f"{token}.csv", media_type="text/csv"
        )

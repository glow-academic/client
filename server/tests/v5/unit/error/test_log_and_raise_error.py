"""
Tests for app.utils.error.log_and_raise_error
"""

from unittest.mock import MagicMock, patch

import asyncpg  # type: ignore
import pytest
from fastapi import HTTPException, Request

from app.utils.error.log_and_raise_error import log_and_raise_error


class TestLog_And_Raise_Error:
    """Tests for log_and_raise_error function."""

    def test_log_and_raise_error_http_exception(self) -> None:
        """Test log_and_raise_error with HTTPException."""
        error = HTTPException(status_code=404, detail="Not found")
        route_path = "/api/v3/test"
        operation = "test_operation"

        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(error, route_path, operation)

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Not found"

    def test_log_and_raise_error_sql_error(self) -> None:
        """Test log_and_raise_error with SQL error."""
        error = asyncpg.PostgresError("Database error")
        route_path = "/api/v3/test"
        operation = "test_operation"
        sql_query = "SELECT * FROM test"
        sql_params = ("param1", "param2")

        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(error, route_path, operation, sql_query, sql_params)

        assert exc_info.value.status_code == 500
        assert "Database error" in exc_info.value.detail

    def test_log_and_raise_error_generic_error(self) -> None:
        """Test log_and_raise_error with generic error."""
        error = ValueError("Generic error")
        route_path = "/api/v3/test"
        operation = "test_operation"

        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(error, route_path, operation)

        assert exc_info.value.status_code == 500
        assert "Generic error" in exc_info.value.detail

    def test_log_and_raise_error_with_request(self) -> None:
        """Test log_and_raise_error with Request object."""
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"

        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url = MagicMock()
        mock_request.url.__str__ = MagicMock(return_value="http://test/api/v3/test")
        mock_request.state = MagicMock()
        mock_request.state.user_id = "user123"
        mock_request.state.profile_id = "profile456"

        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(error, route_path, operation, request=mock_request)

        assert exc_info.value.status_code == 500

    def test_log_and_raise_error_user_friendly_message(self) -> None:
        """Test log_and_raise_error with custom user-friendly message."""
        error = ValueError("Technical error")
        route_path = "/api/v3/test"
        operation = "test_operation"
        user_friendly_message = "Something went wrong. Please try again."

        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(
                error,
                route_path,
                operation,
                user_friendly_message=user_friendly_message,
            )

        assert exc_info.value.status_code == 500
        assert exc_info.value.detail == user_friendly_message

    def test_log_and_raise_error_minimal_params(self) -> None:
        """Test log_and_raise_error with minimal parameters."""
        error = ValueError("Error")

        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(error)

        assert exc_info.value.status_code == 500
        assert "Error" in exc_info.value.detail

    def test_log_and_raise_error_logging(self) -> None:
        """Test that log_and_raise_error logs the error."""
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"

        with patch("app.utils.error.log_and_raise_error.logger") as mock_logger:
            with pytest.raises(HTTPException):
                log_and_raise_error(error, route_path, operation)

            mock_logger.error.assert_called_once()
            call_args = mock_logger.error.call_args
            assert "test_operation" in str(call_args)

"""
Tests for app.utils.error.handle_route_error
"""

from unittest.mock import MagicMock, patch

import asyncpg  # type: ignore
import pytest
from fastapi import HTTPException, Request

from app.utils.error.handle_route_error import handle_route_error


class TestHandle_Route_Error:
    """Tests for handle_route_error function."""

    def test_handle_route_error_raises(self) -> None:
        """Test that handle_route_error always raises."""
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"

        with pytest.raises(HTTPException) as exc_info:
            handle_route_error(error, route_path, operation)

        assert exc_info.value.status_code == 500

    def test_handle_route_error_with_sql(self) -> None:
        """Test handle_route_error with SQL query and params."""
        error = asyncpg.PostgresError("SQL error")
        route_path = "/api/v3/test"
        operation = "test_operation"
        sql_query = "SELECT * FROM test"
        sql_params = ("param1", "param2")

        with pytest.raises(HTTPException) as exc_info:
            handle_route_error(error, route_path, operation, sql_query, sql_params)

        assert exc_info.value.status_code == 500

    def test_handle_route_error_with_request(self) -> None:
        """Test handle_route_error with Request object."""
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"

        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.url = MagicMock()
        mock_request.url.__str__ = MagicMock(return_value="http://test/api/v3/test")

        with pytest.raises(HTTPException) as exc_info:
            handle_route_error(error, route_path, operation, request=mock_request)

        assert exc_info.value.status_code == 500

    def test_handle_route_error_calls_log_and_raise_error(self) -> None:
        """Test that handle_route_error calls log_and_raise_error."""
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"

        with patch(
            "app.utils.error.handle_route_error.log_and_raise_error"
        ) as mock_log_and_raise:
            mock_log_and_raise.side_effect = HTTPException(
                status_code=500, detail="Test"
            )

            with pytest.raises(HTTPException):
                handle_route_error(error, route_path, operation)

            mock_log_and_raise.assert_called_once_with(
                error=error,
                route_path=route_path,
                operation=operation,
                sql_query=None,
                sql_params=None,
                request=None,
            )

    def test_handle_route_error_never_returns(self) -> None:
        """Test that handle_route_error never returns normally."""
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"

        # This should always raise, never return
        with pytest.raises(HTTPException):
            handle_route_error(error, route_path, operation)

        # If we somehow catch the HTTPException and continue, we should never
        # reach a return statement (the function has NoReturn type hint)

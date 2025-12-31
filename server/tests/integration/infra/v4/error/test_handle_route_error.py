"""Integration tests for app.infra.v4.error.handle_route_error."""

import pytest
from fastapi import HTTPException
from utils.sql_helper import load_sql

from app.infra.v4.error.handle_route_error import handle_route_error


class TestHandleRouteError:
    """Tests for handle_route_error function."""

    def test_handle_route_error_raises_http_exception(self) -> None:
        """Test handle_route_error raises HTTPException."""
        # Arrange
        error = ValueError("Test error")
        route_path = "/api/v4/test"
        operation = "test_operation"

        # Act & Assert
        with pytest.raises(HTTPException):
            handle_route_error(
                error=error,
                route_path=route_path,
                operation=operation,
            )

    def test_handle_route_error_with_sql_query(self) -> None:
        """Test handle_route_error with SQL query."""
        # Arrange
        error = ValueError("Test error")
        route_path = "/api/v4/test"
        operation = "test_operation"
        # Use a simple SQL string for testing
        sql_query = "SELECT 1"
        sql_params = ("param1", "param2")

        # Act & Assert
        with pytest.raises(HTTPException):
            handle_route_error(
                error=error,
                route_path=route_path,
                operation=operation,
                sql_query=sql_query,
                sql_params=sql_params,
            )

    def test_handle_route_error_with_request(self) -> None:
        """Test handle_route_error with Request object."""
        # Arrange
        error = ValueError("Test error")
        route_path = "/api/v4/test"
        operation = "test_operation"

        # Create a proper Request object with required scope fields
        from starlette.requests import Request as StarletteRequest

        scope = {
            "type": "http",
            "method": "GET",
            "path": route_path,
            "headers": [],
            "query_string": b"",
            "server": ("localhost", 8000),
        }
        request = StarletteRequest(scope)

        # Act & Assert
        with pytest.raises(HTTPException):
            handle_route_error(
                error=error,
                route_path=route_path,
                operation=operation,
                request=request,
            )


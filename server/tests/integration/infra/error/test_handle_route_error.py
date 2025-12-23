"""Integration tests for app.infra.v3.error.handle_route_error."""

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from app.infra.v3.error.handle_route_error import handle_route_error


class TestHandleRouteError:
    """Tests for handle_route_error function."""

    def test_handle_route_error_raises_http_exception(self) -> None:
        """Test handle_route_error raises HTTPException."""
        # Arrange
        error = ValueError("Test error")
        route_path = "/api/v3/test"
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
        route_path = "/api/v3/test"
        operation = "test_operation"
        sql_query = "SELECT * FROM test"
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
        route_path = "/api/v3/test"
        operation = "test_operation"
        
        # Create a mock request
        app = TestClient(lambda: None).app
        request = Request({"type": "http", "method": "GET", "path": route_path})

        # Act & Assert
        with pytest.raises(HTTPException):
            handle_route_error(
                error=error,
                route_path=route_path,
                operation=operation,
                request=request,
            )


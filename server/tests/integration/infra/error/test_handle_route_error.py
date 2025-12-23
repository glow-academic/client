"""Integration tests for app.infra.v3.error.handle_route_error."""

import pytest
from app.infra.v3.error.handle_route_error import handle_route_error
from fastapi import HTTPException
from utils.sql_helper import load_sql


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
        sql_query = load_sql("tests/sql/integration/infra/error/mock_select_test.sql")
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


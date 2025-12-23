"""Integration tests for app.infra.v3.error.log_and_raise_error."""

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient
from app.infra.v3.error.log_and_raise_error import log_and_raise_error


class TestLogAndRaiseError:
    """Tests for log_and_raise_error function."""

    def test_log_and_raise_error_raises_http_exception(self) -> None:
        """Test log_and_raise_error raises HTTPException."""
        # Arrange
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(
                error=error,
                route_path=route_path,
                operation=operation,
            )
        
        assert exc_info.value.status_code == 500

    def test_log_and_raise_error_with_sql_query(self) -> None:
        """Test log_and_raise_error with SQL query."""
        # Arrange
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"
        sql_query = "SELECT * FROM test"
        sql_params = ("param1", "param2")

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(
                error=error,
                route_path=route_path,
                operation=operation,
                sql_query=sql_query,
                sql_params=sql_params,
            )
        
        assert exc_info.value.status_code == 500

    def test_log_and_raise_error_with_request(self) -> None:
        """Test log_and_raise_error with Request object."""
        # Arrange
        error = ValueError("Test error")
        route_path = "/api/v3/test"
        operation = "test_operation"
        
        # Create a mock request
        app = TestClient(lambda: None).app
        request = Request({"type": "http", "method": "GET", "path": route_path})

        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            log_and_raise_error(
                error=error,
                route_path=route_path,
                operation=operation,
                request=request,
            )
        
        assert exc_info.value.status_code == 500


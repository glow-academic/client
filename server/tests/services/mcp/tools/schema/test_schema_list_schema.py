# tests/services/mcp/tools/schema/test_list_schema.py

from unittest.mock import MagicMock, patch
import pytest
from sqlalchemy.exc import OperationalError

from app.services.mcp.tools.schema.list_schema import list_schema

# We patch the 'engine' object that the tool imports and uses directly.
@patch("app.services.mcp.tools.schema.list_schema.engine")
class TestList_Schema:
    """Unit tests for the list_schema function."""

    def test_list_schema_success(self, mock_engine):
        """Tests that list_schema correctly formats the output from the DB."""
        # Arrange: Configure the mock engine to simulate a successful connection
        # and return specific rows when a query is executed.
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        mock_rows = [
            ("profiles", "id", "uuid"),
            ("profiles", "first_name", "text"),
            ("agents", "id", "uuid"),
        ]
        mock_connection.execute.return_value = mock_rows

        # Act
        result = list_schema()

        # Assert
        expected_output = (
            "profiles.id uuid\n"
            "profiles.first_name text\n"
            "agents.id uuid"
        )
        assert result == expected_output
        mock_engine.connect.assert_called_once()
        mock_connection.execute.assert_called_once()

    def test_list_schema_error(self, mock_engine):
        """Tests that list_schema raises an error if the DB connection fails."""
        # Arrange: Configure the mock engine to raise an error on connect.
        mock_engine.connect.side_effect = OperationalError("Connection failed", {}, None)

        # Act & Assert: The function itself doesn't catch the error, so we
        # expect the test to raise the same error.
        with pytest.raises(OperationalError, match="Connection failed"):
            list_schema()
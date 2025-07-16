# tests/services/mcp/tools/schema/test_query_data.py

from unittest.mock import MagicMock, patch
from sqlalchemy.exc import ProgrammingError

from app.services.mcp.tools.schema.query_data import query_data

@patch("app.services.mcp.tools.schema.query_data.engine")
class Test_Query_Data:
    """Unit tests for the query_data function."""

    def test_query_data_success(self, mock_engine):
        """Tests a successful SELECT query returns formatted data."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        mock_row = MagicMock()
        mock_row.__str__.return_value = "('John', 'Doe')"
        mock_connection.execute.return_value.fetchmany.return_value = [mock_row]

        result = query_data("SELECT first_name, last_name FROM profiles LIMIT 1")

        assert result == "('John', 'Doe')"
        mock_connection.execute.assert_called_once()

    def test_query_data_with_like_clause(self, mock_engine):
        """Tests that a query with a LIKE clause is constructed and run correctly."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        mock_row = MagicMock()
        mock_row.__str__.return_value = "('First Cohort',)"
        mock_connection.execute.return_value.fetchmany.return_value = [mock_row]

        # The purpose of this test is to ensure that a query containing LIKE
        # passes the security check and is executed.
        sql = "SELECT title FROM cohorts WHERE title LIKE '%First%'"
        result = query_data(sql)

        assert result == "('First Cohort',)"
        # Verify the execute call was made, proving the query passed the check.
        mock_connection.execute.assert_called_once()

    def test_query_data_blocks_non_select_queries(self, mock_engine):
        """Tests that write operations (UPDATE, DELETE, etc.) are blocked."""
        result_update = query_data("UPDATE profiles SET first_name = 'Jane'")
        result_delete = query_data("DELETE FROM profiles")
        
        expected_error = "Error: only read-only queries are allowed."
        assert result_update == expected_error
        assert result_delete == expected_error
        mock_engine.connect.assert_not_called()

    def test_query_data_handles_db_error(self, mock_engine):
        """Tests that a database error during execution is caught and returned."""
        # Arrange: Make the connect call raise a SQLAlchemy error.
        # The .orig attribute holds the core DBAPI error message.
        error = ProgrammingError("syntax error", params=None, orig="underlying DB error")
        mock_engine.connect.side_effect = error

        result = query_data("SELECT * FROM non_existent_table")

        # Assert: The function should catch the error and return the .orig part.
        assert result == "Error: underlying DB error"

import pytest

@pytest.mark.skip(reason="TODO: implement tests for `query_data`")
class TestQuery_Data:
    """Tests for query_data function."""

    def test_query_data_success(self):
        """Test successful query_data execution."""
        # TODO: Implement test for query_data
        assert False, "IMPLEMENT: Test for query_data"

    def test_query_data_error(self):
        """Test query_data error handling."""
        # TODO: Implement error test for query_data
        assert False, "IMPLEMENT: Error test for query_data"


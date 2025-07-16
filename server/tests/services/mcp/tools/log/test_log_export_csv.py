# tests/services/mcp/tools/log/test_export_csv.py

from pathlib import Path
from unittest.mock import ANY, MagicMock, mock_open, patch

import pytest
from app.services.mcp.tools.log.export_csv import export_csv
from sqlalchemy.exc import ProgrammingError


@patch("app.services.mcp.tools.log.export_csv.engine")
@patch("app.services.mcp.tools.log.export_csv.CSV_FOLDER", Path("/tmp/csv_test"))
@patch("builtins.open", new_callable=mock_open)
class TestExport_Csv:
    """Tests for the export_csv function."""

    def test_export_csv_success(self, mock_open_file, mock_engine):
        """Tests that a successful query writes a CSV file and returns a token."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        mock_row_data = {"first_name": "John", "last_name": "Doe"}
        mock_row = MagicMock()
        mock_row.__iter__.return_value = iter(mock_row_data.values())
        mock_row.keys.return_value = mock_row_data.keys()
        
        mock_connection.execute.return_value.fetchmany.return_value = [mock_row]

        result = export_csv("SELECT first_name, last_name FROM profiles")

        assert "CSV exported successfully" in result
        
        # Verify the file was opened correctly
        mock_open_file.assert_called_once_with(ANY, "w", encoding="utf-8")
        
        # FIX: Check the content of the single write call
        expected_csv_content = "first_name,last_name\r\nJohn,Doe\r\n"
        file_handle = mock_open_file()
        file_handle.write.assert_called_once_with(expected_csv_content)

    def test_export_csv_no_data(self, mock_open_file, mock_engine):
        """Tests that the function returns a message when the query yields no rows."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        mock_connection.execute.return_value.fetchmany.return_value = [] # No rows

        result = export_csv("SELECT * FROM profiles WHERE id = 'non-existent'")
        
        assert result == "No data to export."
        # Ensure no file was opened or written
        mock_open_file.assert_not_called()

    def test_export_csv_blocks_non_select(self, mock_open_file, mock_engine):
        """Tests that the function blocks non-SELECT queries."""
        result = export_csv("DELETE FROM profiles")
        
        assert result == "Error: only SELECT queries are allowed for CSV export."
        mock_engine.connect.assert_not_called()

    def test_export_csv_handles_db_error(self, mock_open_file, mock_engine):
        """Tests that a SQLAlchemyError is caught and handled."""
        error = ProgrammingError("syntax error", {}, None)
        mock_engine.connect.side_effect = error
        
        result = export_csv("SELECT foo FROM bar")
        
        assert "Error:" in result
        assert "syntax error" in str(result)
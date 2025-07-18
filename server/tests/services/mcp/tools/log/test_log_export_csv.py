# tests/services/mcp/tools/log/test_log_export_csv.py

from pathlib import Path
from unittest.mock import ANY, MagicMock, mock_open, patch

from app.services.mcp.tools.log.export_csv import export_csv
from sqlalchemy.exc import ProgrammingError


@patch("app.services.mcp.tools.log.export_csv.csv")
@patch("app.services.mcp.tools.log.export_csv.engine")
@patch("app.services.mcp.tools.log.export_csv.CSV_FOLDER", Path("/tmp/csv_test"))
@patch("builtins.open", new_callable=mock_open)
class TestExport_Csv:
    """Tests for the export_csv function."""

    # FIX: Corrected the order of mock arguments
    def test_export_csv_success(self, mock_open_file, mock_engine, mock_csv_module):
        """Tests that the CSV writer receives correct, simple data types."""
        # Setup
        mock_writer = MagicMock()
        mock_csv_module.writer.return_value = mock_writer

        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection

        mock_rows = [("John", "Doe"), ("Jane", "Smith")]
        mock_result = MagicMock()
        mock_result.keys.return_value = ["first_name", "last_name"]
        mock_result.fetchmany.return_value = mock_rows
        mock_connection.execute.return_value = mock_result

        # Execute
        result = export_csv("SELECT first_name, last_name FROM profiles")

        # Assert
        assert "CSV exported successfully" in result
        mock_writer.writerow.assert_called_once_with(["first_name", "last_name"])
        mock_writer.writerows.assert_called_once()
        written_data = mock_writer.writerows.call_args[0][0]
        assert list(written_data) == [("John", "Doe"), ("Jane", "Smith")]
        mock_open_file.assert_called_once_with(ANY, "w", encoding="utf-8")

    # FIX: Corrected the order of mock arguments
    def test_export_csv_no_data(self, mock_open_file, mock_engine, mock_csv_module):
        """Tests that the function returns a message when the query yields no rows."""
        mock_connection = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        mock_result = MagicMock()
        mock_result.keys.return_value = ["first_name", "last_name"]
        mock_result.fetchmany.return_value = []  # No rows
        mock_connection.execute.return_value = mock_result

        result = export_csv("SELECT * FROM profiles WHERE id = 'non-existent'")

        assert result == "No data to export."
        mock_open_file.assert_not_called()

    # FIX: Corrected the order of mock arguments
    def test_export_csv_blocks_non_select(
        self, mock_open_file, mock_engine, mock_csv_module
    ):
        """Tests that the function blocks non-SELECT queries."""
        result = export_csv("DELETE FROM profiles")

        assert result == "Error: only SELECT queries are allowed for CSV export."
        mock_engine.connect.assert_not_called()

    # FIX: Corrected the order of mock arguments
    def test_export_csv_handles_db_error(
        self, mock_open_file, mock_engine, mock_csv_module
    ):
        """Tests that a SQLAlchemyError is caught and handled."""
        error = ProgrammingError("syntax error", {}, None)
        mock_engine.connect.side_effect = error

        result = export_csv("SELECT foo FROM bar")

        assert "Error:" in result
        assert "syntax error" in str(result)

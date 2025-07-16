# tests/services/mcp/tools/log/test_recent_app_logs.py

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from app.services.mcp.tools.log.recent_app_logs import recent_app_logs
from sqlalchemy.exc import SQLAlchemyError


class MockAppLog:
    def __init__(self, id, level, message, created_at):
        self.id, self.level, self.message, self.created_at = id, level, message, created_at
        self.context = {}
    def isoformat(self):
        return self.created_at.isoformat()

@patch("app.services.mcp.tools.log.recent_app_logs.get_session")
class TestRecent_App_Logs:
    """Tests for the recent_app_logs function."""

    def test_recent_app_logs_success_with_filter(self, mock_get_session):
        """Tests fetching logs with a specific level filter."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        now = datetime.now()

        # FIX: The mock now only returns the logs that would match the query's WHERE clause.
        # This accurately simulates the database filtering the data for us.
        filtered_mock_logs = [
            MockAppLog(1, "error", "Critical failure", now),
            MockAppLog(3, "error", "Another failure", now - timedelta(minutes=5)),
        ]
        mock_session.exec.return_value.all.return_value = filtered_mock_logs

        result = recent_app_logs(level="error", limit=5)
        
        assert len(result) == 2
        assert all(log["level"] == "error" for log in result)
        assert result[0]["message"] == "Critical failure"
        assert result[1]["message"] == "Another failure"

    def test_recent_app_logs_limit(self, mock_get_session):
        """Tests that the result set is correctly limited."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        now = datetime.now()

        mock_logs = [
            MockAppLog(i, "info", f"Log {i}", now - timedelta(minutes=i))
            for i in range(10)
        ]
        mock_session.exec.return_value.all.return_value = mock_logs
        
        result = recent_app_logs(level="all", limit=5)
        
        assert len(result) == 5
        # The first log in the result should be the most recent one (Log 0)
        assert result[0]["message"] == "Log 0"

    def test_recent_app_logs_handles_db_error(self, mock_get_session):
        """Tests that a database error is handled correctly."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.side_effect = SQLAlchemyError("DB connection lost")

        result = recent_app_logs()

        assert result == [{"error": "Database error: DB connection lost"}]
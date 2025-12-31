"""
Tests for app.utils.debug_info
"""

import importlib
import sys
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch


def mock_function_tool(func: Any) -> Any:
    """Mock function_tool decorator - returns function unchanged."""
    return func


class TestDebug_Info:
    """Tests for debug_info function."""

    def test_debug_info_success(self) -> None:
        """Test successful debug_info execution."""
        # Patch function_tool before importing the module
        with patch("agents.function_tool", mock_function_tool):
            # Reload the module to pick up the mocked decorator
            if "app.utils.debug_info" in sys.modules:
                importlib.reload(sys.modules["app.utils.debug_info"])
            from app.infra.v4.debug.debug_info import DebugContext, debug_info

            model_run_id = uuid.uuid4()
            mock_conn = AsyncMock()
            mock_conn.execute = AsyncMock()

            debug_context = DebugContext(conn=mock_conn, model_run_id=model_run_id)

            # Create mock RunContextWrapper
            mock_ctx = MagicMock()
            mock_ctx.context = debug_context

            # Mock load_sql and asyncio.create_task
            with (
                patch("app.utils.debug_info.load_sql", return_value="INSERT INTO ..."),
                patch("asyncio.create_task") as mock_create_task,
            ):
                result = debug_info(mock_ctx, "Test debug message")

                # Should return a confirmation string
                assert result == "Saved debug info"
                # Verify create_task was called (fire-and-forget)
                mock_create_task.assert_called_once()

    def test_debug_info_handles_exception(self) -> None:
        """Test debug_info error handling."""
        # Patch function_tool before importing the module
        with patch("agents.function_tool", mock_function_tool):
            # Reload the module to pick up the mocked decorator
            if "app.utils.debug_info" in sys.modules:
                importlib.reload(sys.modules["app.utils.debug_info"])
            from app.infra.v4.debug.debug_info import DebugContext, debug_info

            model_run_id = uuid.uuid4()
            mock_conn = AsyncMock()
            mock_conn.execute = AsyncMock(side_effect=Exception("Database error"))

            debug_context = DebugContext(conn=mock_conn, model_run_id=model_run_id)

            # Create mock RunContextWrapper
            mock_ctx = MagicMock()
            mock_ctx.context = debug_context

            # Mock load_sql to raise an exception
            with (
                patch(
                    "app.utils.debug_info.load_sql", side_effect=Exception("SQL error")
                ),
                patch("builtins.print"),
            ):  # Suppress print output
                result = debug_info(mock_ctx, "Test debug message")

                # Should return an error message
                assert isinstance(result, str)
                assert "Error saving debug info" in result

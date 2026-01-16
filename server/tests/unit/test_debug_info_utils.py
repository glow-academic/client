"""
Tests for app.utils.debug_info
"""

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestDebug_Info:
    """Tests for debug_info function."""

    @pytest.mark.asyncio
    async def test_debug_info_success(self) -> None:
        """Test successful debug_info execution."""
        from app.infra.v4.debug.debug_info import DebugContext, debug_info

        model_run_id = uuid.uuid4()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock()

        debug_context = DebugContext(conn=mock_conn, run_id=model_run_id)

        # Create mock context (can be dict or object with context attribute)
        mock_ctx = MagicMock()
        mock_ctx.context = debug_context
        mock_ctx.run_id = model_run_id
        mock_ctx.conn = mock_conn

        # Mock execute_sql_typed and asyncio.create_task
        with (
            patch("app.infra.v4.debug.debug_info.execute_sql_typed", new_callable=AsyncMock) as mock_execute,
            patch("asyncio.create_task") as mock_create_task,
        ):
            result = await debug_info(mock_ctx, "Test debug message")

            # Should return a confirmation string
            assert result == "Saved debug info"
            # Verify create_task was called (fire-and-forget)
            mock_create_task.assert_called_once()

    async def test_debug_info_handles_exception(self) -> None:
        """Test debug_info error handling."""
        from app.infra.v4.debug.debug_info import DebugContext, debug_info

        model_run_id = uuid.uuid4()
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock(side_effect=Exception("Database error"))

        debug_context = DebugContext(conn=mock_conn, run_id=model_run_id)

        # Create mock context
        mock_ctx = MagicMock()
        mock_ctx.context = debug_context
        mock_ctx.run_id = model_run_id
        mock_ctx.conn = mock_conn

        # Mock execute_sql_typed to raise an exception
        with (
            patch(
                "app.infra.v4.debug.debug_info.execute_sql_typed", side_effect=Exception("SQL error")
            ),
            patch("builtins.print"),
        ):  # Suppress print output
            result = await debug_info(mock_ctx, "Test debug message")

            # Should return an error message
            assert isinstance(result, str)
            assert "Error saving debug info" in result

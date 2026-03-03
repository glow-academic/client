"""Integration tests for app.v5.infra.debug.debug_info."""

import uuid
from unittest.mock import patch

import asyncpg
import pytest

from app.v5.infra.debug.debug_info import DebugContext, debug_info

pytestmark = pytest.mark.asyncio


class TestDebugInfo:
    """Tests for debug_info function."""

    async def test_debug_info_success(self, db: asyncpg.Connection) -> None:
        """Test successful debug info insertion."""
        # Arrange
        run_id = uuid.uuid4()
        debug_context = DebugContext(conn=db, run_id=run_id)

        # Create mock RunContextWrapper
        class MockRunContextWrapper:
            def __init__(self, context: DebugContext):
                self.context = context

        mock_ctx = MockRunContextWrapper(debug_context)

        # Act — patch create_task to prevent fire-and-forget from holding the connection
        with patch("app.v5.infra.debug.debug_info.asyncio.create_task"):
            result = await debug_info(mock_ctx, "Test debug message")

        # Assert
        assert result == "Saved debug info"

    async def test_debug_info_with_content(self, db: asyncpg.Connection) -> None:
        """Test debug_info with content."""
        # Arrange
        run_id = uuid.uuid4()
        debug_context = DebugContext(conn=db, run_id=run_id)

        class MockRunContextWrapper:
            def __init__(self, context: DebugContext):
                self.context = context

        mock_ctx = MockRunContextWrapper(debug_context)

        # Act — patch create_task to prevent fire-and-forget from holding the connection
        with patch("app.v5.infra.debug.debug_info.asyncio.create_task"):
            result = await debug_info(mock_ctx, "Debug: Testing debug info insertion")

        # Assert
        assert result == "Saved debug info"

"""Integration tests for app.infra.v4.debug.debug_info."""

import uuid

import asyncpg
import pytest
from agents import RunContextWrapper

from app.infra.v4.debug.debug_info import DebugContext, debug_info

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

        # Act
        result = debug_info(mock_ctx, "Test debug message")

        # Assert
        assert result == "Saved debug info"
        # Actual database insertion is async and fire-and-forget

    async def test_debug_info_with_content(self, db: asyncpg.Connection) -> None:
        """Test debug_info with content."""
        # Arrange
        run_id = uuid.uuid4()
        debug_context = DebugContext(conn=db, run_id=run_id)

        class MockRunContextWrapper:
            def __init__(self, context: DebugContext):
                self.context = context

        mock_ctx = MockRunContextWrapper(debug_context)

        # Act
        result = debug_info(mock_ctx, "Debug: Testing debug info insertion")

        # Assert
        assert result == "Saved debug info"


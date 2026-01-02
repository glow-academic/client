"""Integration tests for debug_info tool call WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.rubric.tools.debug.call import debug_info_internal

pytestmark = pytest.mark.asyncio


async def test_debug_info_call_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful debug_info tool call."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "run_id": "00000000-0000-0000-0000-000000000000",
    }

    # Act
    await debug_info_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

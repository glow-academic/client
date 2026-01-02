"""Integration tests for debug_eval_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.rubric.tools.debug.eval import debug_eval_internal

pytestmark = pytest.mark.asyncio


async def test_debug_eval_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful debug_eval_start event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "run_id": "00000000-0000-0000-0000-000000000000",
    }

    # Act
    await debug_eval_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

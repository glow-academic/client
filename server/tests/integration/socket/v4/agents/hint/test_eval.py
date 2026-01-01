"""Integration tests for hint_eval WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.hint.eval import hint_eval_internal

pytestmark = pytest.mark.asyncio


async def test_hint_eval_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful hint_eval internal event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "content": "Test content",
    }

    # Act
    await hint_eval_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

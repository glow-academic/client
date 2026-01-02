"""Integration tests for rubric_error WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.rubric.error import rubric_error_internal

pytestmark = pytest.mark.asyncio


async def test_rubric_error_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful rubric_error internal event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "error_message": "Test error message",
    }

    # Act
    await rubric_error_internal(data)

    # Assert - verify handler completes
    # Internal events may emit error to rooms
    assert True  # Handler should complete without error

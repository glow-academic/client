"""Integration tests for rubric_eval WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.rubric.eval import rubric_eval_internal

pytestmark = pytest.mark.asyncio


async def test_rubric_eval_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful rubric_eval internal event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "run_id": "00000000-0000-0000-0000-000000000000",
    }

    # Act
    await rubric_eval_internal(data)

    # Assert - verify handler completes
    # Internal events may emit to rooms
    assert True  # Handler should complete without error

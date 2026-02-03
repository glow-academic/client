"""Integration tests for test_join WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.socket.v4.artifacts.test.room import test_join
from app.infra.v4.websocket.set_socket_owner import set_socket_owner

pytestmark = pytest.mark.asyncio


async def test_test_join_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful test_join event."""
    # Create attempt
    from tests.integration.socket.v4.helpers import (
        create_test_benchmark_attempt,
        get_eval_by_active,
    )

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)

    sid = "test_sid_123"
    await set_socket_owner("965bd24f-dfae-4063-b370-e1373df46322", sid)
    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await test_join(sid, data)

    # Assert - verify socket joined room
    room_name = f"benchmark_{attempt_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]

    # Verify event was emitted
    events = mock_sio.get_events("test_joined")
    assert len(events) == 1
    assert events[0]["attempt_id"] == str(attempt_id)


async def test_test_join_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test test_join with missing attempt_id."""
    sid = "test_sid_123"
    await set_socket_owner("965bd24f-dfae-4063-b370-e1373df46322", sid)
    data = {}

    # Act
    await test_join(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("test_error")
    assert len(error_events) >= 1

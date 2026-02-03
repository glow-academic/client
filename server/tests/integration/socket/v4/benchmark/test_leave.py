"""Integration tests for test_leave WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.socket.v4.artifacts.test.room import test_leave
from app.infra.v4.websocket.set_socket_owner import set_socket_owner

pytestmark = pytest.mark.asyncio


async def test_test_leave_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful test_leave event."""
    # Create attempt
    from tests.integration.socket.v4.helpers import (
        create_test_benchmark_attempt,
        get_eval_by_active,
    )

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)

    # Join room first
    sid = "test_sid_123"
    await set_socket_owner("965bd24f-dfae-4063-b370-e1373df46322", sid)
    room_name = f"benchmark_{attempt_id}"
    await mock_sio.enter_room(sid, room_name)

    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await test_leave(sid, data)

    # Assert - verify socket left room
    assert sid not in mock_sio.rooms.get(room_name, set())

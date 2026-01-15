"""Integration tests for benchmark_leave WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.socket.v4.attempts.benchmark.leave import benchmark_leave

pytestmark = pytest.mark.asyncio


async def test_benchmark_leave_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful benchmark_leave event."""
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
    room_name = f"benchmark_{attempt_id}"
    await mock_sio.enter_room(sid, room_name)

    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await benchmark_leave(sid, data)

    # Assert - verify socket left room
    assert sid not in mock_sio.rooms.get(room_name, set())

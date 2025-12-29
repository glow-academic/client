"""Integration tests for eval_leave WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.evals.leave import eval_leave

pytestmark = pytest.mark.asyncio


async def test_eval_leave_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_leave event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create test eval and attempt
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active) VALUES ('Test Eval', 'Test Description', true) RETURNING id"
    )

    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    sid = "test_sid_123"
    room_name = f"eval_{attempt_id}"
    await mock_sio.enter_room(sid, room_name)

    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await eval_leave(sid, data)

    # Assert - verify socket left room
    assert sid not in mock_sio.rooms.get(room_name, set())

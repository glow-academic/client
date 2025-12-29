"""Integration tests for eval_join WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.evals.join import eval_join

pytestmark = pytest.mark.asyncio


async def test_eval_join_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_join event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create test eval and attempt
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active) VALUES ('Test Eval', 'Test Description', true) RETURNING id"
    )

    # Create an eval attempt (eval_attempts table - no profile_id or active columns)
    attempt_id = await db.fetchval(
        "INSERT INTO eval_attempts(eval_id) VALUES ($1) RETURNING id",
        eval_id,
    )

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await eval_join(sid, data)

    # Assert - verify socket joined room
    room_name = f"eval_{attempt_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]

    # Verify event was emitted
    events = mock_sio.get_events("evals_joined")
    assert len(events) == 1
    assert events[0]["attempt_id"] == str(attempt_id)

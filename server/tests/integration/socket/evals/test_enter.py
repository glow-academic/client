"""Integration tests for eval_enter WebSocket event."""

import asyncpg  # type: ignore
import pytest
from datetime import datetime, UTC
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.evals.enter import eval_enter

pytestmark = pytest.mark.asyncio


async def test_eval_enter_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_enter event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create test eval
    eval_id = await db.fetchval(
        "INSERT INTO evals(title, active) VALUES ('Test Eval', true) RETURNING id"
    )

    # Create test
    test_id = await db.fetchval(
        "INSERT INTO tests(eval_id, profile_id, active) "
        "VALUES ($1, $2, true) RETURNING id",
        eval_id,
        profile_id,
    )

    sid = "test_sid_123"
    created_at = datetime.now(UTC).isoformat()
    data = {
        "test_id": str(test_id),
        "created_at": created_at,
    }

    # Act
    await eval_enter(sid, data)

    # Assert - verify test created_at was updated
    test_row = await db.fetchrow(
        "SELECT * FROM tests WHERE id = $1", test_id
    )
    assert test_row is not None

    # Verify event was emitted
    events = mock_sio.get_events("evals_enter_response")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["test_id"] == str(test_id)


async def test_eval_enter_missing_test_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test eval_enter with missing test_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "created_at": datetime.now(UTC).isoformat(),
    }

    # Act
    await eval_enter(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("evals_enter_error")
    assert len(error_events) >= 1


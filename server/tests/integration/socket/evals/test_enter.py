"""Integration tests for eval_enter WebSocket event."""

from datetime import UTC, datetime

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.benchmark.enter import benchmark_enter as eval_enter

pytestmark = pytest.mark.asyncio


async def test_eval_enter_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful eval_enter event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create test eval
    eval_id = await db.fetchval(
        "INSERT INTO evals(name, description, active) VALUES ('Test Eval', 'Test Description', true) RETURNING id"
    )

    # Create a run first (tests table requires run_id)
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    # Create test (tests table requires title, trace_id, and run_id)
    test_id = await db.fetchval(
        "INSERT INTO tests(title, trace_id, run_id) "
        "VALUES ('Test Title', 'test-trace-id', $1) RETURNING id",
        run_id,
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
    test_row = await db.fetchrow("SELECT * FROM tests WHERE id = $1", test_id)
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

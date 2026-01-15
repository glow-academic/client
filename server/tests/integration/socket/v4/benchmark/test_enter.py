"""Integration tests for benchmark_enter WebSocket event."""

from datetime import UTC, datetime

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.socket.v4.attempts.benchmark.enter import benchmark_enter

pytestmark = pytest.mark.asyncio


async def test_benchmark_enter_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful benchmark_enter event."""
    # Create test
    from tests.integration.socket.v4.helpers import create_test_test

    test_id = await create_test_test(db)

    sid = "test_sid_123"
    created_at = datetime.now(UTC).isoformat()
    data = {
        "test_id": str(test_id),
        "created_at": created_at,
    }

    # Act
    await benchmark_enter(sid, data)

    # Assert - verify event was emitted
    events = mock_sio.get_events("benchmarks_enter_response")
    assert len(events) == 1
    assert events[0]["success"] is True
    assert events[0]["test_id"] == str(test_id)


async def test_benchmark_enter_missing_test_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test benchmark_enter with missing test_id."""
    sid = "test_sid_123"
    data = {
        "created_at": datetime.now(UTC).isoformat(),
    }

    # Act
    await benchmark_enter(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("benchmarks_enter_error")
    assert len(error_events) >= 1

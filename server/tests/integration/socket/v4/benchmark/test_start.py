"""Integration tests for benchmark_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.socket.v4.benchmark.start import benchmark_start

pytestmark = pytest.mark.asyncio


async def test_benchmark_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful benchmark start."""
    # Get an eval_id
    from tests.integration.socket.v4.helpers import get_eval_by_active

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    sid = "test_sid_123"
    data = {
        "eval_id": eval_id,
        "infinite_mode": False,
    }

    await benchmark_start(sid, data)

    # Verify events were emitted
    started_events = mock_sio.get_events("benchmarks_started")
    assert len(started_events) == 1
    assert started_events[0]["success"] is True
    assert "attempt_id" in started_events[0]


async def test_benchmark_start_missing_eval_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test benchmark_start with missing eval_id."""
    sid = "test_sid_123"
    data = {
        "infinite_mode": False,
    }

    await benchmark_start(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("benchmarks_start_error")
    assert len(error_events) >= 1

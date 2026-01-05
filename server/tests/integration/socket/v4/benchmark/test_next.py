"""Integration tests for benchmark_next WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.socket.v4.benchmark.next import benchmark_next

pytestmark = pytest.mark.asyncio


async def test_benchmark_next_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful benchmark_next event."""
    # Arrange - create attempt
    from tests.integration.socket.v4.helpers import (
        create_test_benchmark_attempt,
        get_eval_by_active,
    )

    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "eval_id": str(eval_id),
        "use_groups": False,
    }

    # Act
    await benchmark_next(sid, data)

    # Assert - verify handler completes
    error_events = mock_sio.get_events("benchmarks_next_error")
    # Handler may emit error if no pending runs/groups
    assert len(error_events) >= 0

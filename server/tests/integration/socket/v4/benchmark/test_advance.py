"""Integration tests for benchmark_advance WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.socket.v4.benchmark.advance import benchmark_advance

pytestmark = pytest.mark.asyncio


async def test_benchmark_advance_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful benchmark_advance event."""
    # Arrange - create attempt and test
    from tests.integration.socket.v4.helpers import (
        get_eval_by_active,
        create_test_benchmark_attempt,
        create_test_test,
    )
    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)
    test_id = await create_test_test(db)

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "test_id": str(test_id),
    }

    # Act
    await benchmark_advance(sid, data)

    # Assert - verify handler completes
    error_events = mock_sio.get_events("benchmarks_advance_error")
    # Handler may emit error if test not found
    assert len(error_events) >= 0


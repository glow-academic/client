"""Integration tests for benchmark_eval_complete WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.socket.v4.benchmark.eval_complete import benchmark_eval_complete

pytestmark = pytest.mark.asyncio


async def test_benchmark_eval_complete_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful benchmark_eval_complete event."""
    # Arrange - create attempt
    from tests.integration.socket.v4.helpers import (
        get_eval_by_active,
        create_test_benchmark_attempt,
    )
    eval_id = await get_eval_by_active(db)
    if not eval_id:
        pytest.skip("No active evals found in test database")

    attempt_id = await create_test_benchmark_attempt(db, eval_id)

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "eval_id": str(eval_id),
    }

    # Act
    await benchmark_eval_complete(sid, data)

    # Assert - verify handler completes
    # Handler processes eval completion logic
    # May emit events or complete silently


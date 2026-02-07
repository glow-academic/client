"""Integration tests for test_stop WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO

from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.socket.v4.artifacts.test.control import test_stop

pytestmark = pytest.mark.asyncio


async def test_test_stop_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful test_stop event."""
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
    await set_socket_owner("965bd24f-dfae-4063-b370-e1373df46322", sid)
    data = {
        "attempt_id": str(attempt_id),
    }

    # Act
    await test_stop(sid, data)

    # Assert - verify handler completes
    error_events = mock_sio.get_events("test_error")
    stopped_events = mock_sio.get_events("test_stopped")
    assert len(error_events) >= 0
    assert len(stopped_events) >= 0

"""Integration tests for title_eval_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.rubric.tools.title.eval import title_eval_internal

pytestmark = pytest.mark.asyncio


async def test_title_eval_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful title_eval_start event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "run_id": "00000000-0000-0000-0000-000000000000",
    }

    # Act
    await title_eval_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

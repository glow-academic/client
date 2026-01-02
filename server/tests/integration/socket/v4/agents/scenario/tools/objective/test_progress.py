"""Integration tests for objective_progress WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.scenario.tools.objective.progress import (
    objective_progress_internal,
)

pytestmark = pytest.mark.asyncio


async def test_objective_progress_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful objective_progress event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "content": "Test content",
    }

    # Act
    await objective_progress_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

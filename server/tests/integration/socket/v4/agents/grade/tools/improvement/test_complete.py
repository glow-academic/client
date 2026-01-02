"""Integration tests for improvement_complete WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.grade.tools.improvement.complete import (
    improvement_complete_internal,
)

pytestmark = pytest.mark.asyncio


async def test_improvement_complete_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful improvement_complete event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "content": "Test content",
    }

    # Act
    await improvement_complete_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

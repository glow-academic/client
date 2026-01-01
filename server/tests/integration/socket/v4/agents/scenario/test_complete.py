"""Integration tests for scenario_complete WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.scenario.complete import scenario_complete_internal

pytestmark = pytest.mark.asyncio


async def test_scenario_complete_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful scenario_complete internal event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "content": "Test content",
    }

    # Act
    await scenario_complete_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

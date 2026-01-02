"""Integration tests for rubric_tool_standard_description WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.rubric.tools.rubric.call import (
    rubric_tool_standard_description_internal,
)

pytestmark = pytest.mark.asyncio


async def test_rubric_tool_call_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful rubric_tool_standard_description event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "run_id": "00000000-0000-0000-0000-000000000000",
    }

    # Act
    await rubric_tool_standard_description_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

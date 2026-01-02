"""Integration tests for question_complete WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.scenario.tools.question.complete import (
    question_complete_internal,
)

pytestmark = pytest.mark.asyncio


async def test_question_complete_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful question_complete event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "content": "Test content",
    }

    # Act
    await question_complete_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

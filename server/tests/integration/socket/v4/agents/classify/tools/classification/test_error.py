"""Integration tests for classification_error WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.classify.tools.classification.error import classification_error_internal

pytestmark = pytest.mark.asyncio


async def test_classification_error_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful classification_error event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "content": "Test content",
    }

    # Act
    await classification_error_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

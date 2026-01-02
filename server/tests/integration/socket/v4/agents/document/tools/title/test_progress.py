"""Integration tests for document_tool_title_progress WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.agents.document.tools.title.progress import (
    document_tool_title_progress_internal,
)

pytestmark = pytest.mark.asyncio


async def test_document_tool_title_progress_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful document_tool_title_progress event."""
    # Arrange
    data = {
        "group_id": "00000000-0000-0000-0000-000000000000",
        "content": "Test content",
    }

    # Act
    await document_tool_title_progress_internal(data)

    # Assert - verify handler completes
    assert True  # Handler should complete without error

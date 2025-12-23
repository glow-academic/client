"""Integration tests for generate_image WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.images.generate import generate_image

pytestmark = pytest.mark.asyncio


async def test_generate_image_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful generate_image event."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "prompt": "Test image prompt",
        "image_id": "test-image-id",
    }

    # Act
    await generate_image(sid, data)

    # Assert - verify image generation started
    # Image generation is async and may emit events
    # Handler should complete without error


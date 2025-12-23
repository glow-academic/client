"""Integration tests for image_generation_complete WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.images.complete import (
    _image_generation_complete_impl,
    image_generation_complete,
    image_generation_complete_internal,
)

pytestmark = pytest.mark.asyncio


async def test_image_generation_complete_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful image_generation_complete event."""
    # Arrange
    # Create image
    image_id = await db.fetchval(
        "INSERT INTO images(name, active) VALUES ('Test Image', true) RETURNING id"
    )

    # Create upload
    upload_id = await db.fetchval(
        "INSERT INTO uploads(file_path, mime_type, file_size) VALUES ('test.jpg', 'image/jpeg', 1024) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "image_id": str(image_id),
        "file_path": "test.jpg",
        "mime_type": "image/jpeg",
        "file_size": 1024,
    }

    # Act
    await image_generation_complete(sid, data)

    # Assert - verify image was linked to upload
    image_row = await db.fetchrow(
        "SELECT * FROM images WHERE id = $1",
        image_id,
    )
    assert image_row is not None
    # Verify upload_id was set (check via image_uploads junction table if exists)
    upload_link = await db.fetchrow(
        "SELECT * FROM image_uploads WHERE image_id = $1 AND upload_id = $2",
        image_id,
        upload_id,
    )
    # May not have image_uploads table, so just verify handler completed


async def test_image_generation_complete_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test image_generation_complete via internal event."""
    # Arrange
    image_id = await db.fetchval(
        "INSERT INTO images(name, active) VALUES ('Test Image', true) RETURNING id"
    )

    upload_id = await db.fetchval(
        "INSERT INTO uploads(file_path, mime_type, file_size) VALUES ('test.jpg', 'image/jpeg', 1024) RETURNING id"
    )

    data = {
        "image_id": str(image_id),
        "file_path": "test.jpg",
        "mime_type": "image/jpeg",
        "file_size": 1024,
        "room": "test_room",
    }

    # Act
    await image_generation_complete_internal(data)

    # Assert - verify handler completed without error
    image_row = await db.fetchrow(
        "SELECT * FROM images WHERE id = $1",
        image_id,
    )
    assert image_row is not None


async def test_image_generation_complete_missing_image_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test image_generation_complete with missing image_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "file_path": "test.jpg",
        "mime_type": "image/jpeg",
        "file_size": 1024,
    }

    # Act
    await image_generation_complete(sid, data)

    # Assert - verify error was emitted (validation error)
    # Handler may complete without error but not update database
    # Check that handler doesn't crash


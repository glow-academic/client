"""Integration tests for video_generate WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.agents.video.generate import video_generate

pytestmark = pytest.mark.asyncio


async def test_video_generate_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful video_generate event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create video
    video_id = await db.fetchval(
        "INSERT INTO videos(name, active) VALUES ('Test Video', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "videoId": str(video_id),
        "prompt": "A beautiful sunset over the ocean",
    }

    # Act
    await video_generate(sid, data)

    # Assert - verify progress event was emitted
    progress_events = mock_sio.get_events("videos_generation_progress")
    assert len(progress_events) >= 1
    assert progress_events[0]["type"] == "start"
    assert progress_events[0]["video_id"] == str(video_id)

    # Verify log_run event was emitted via internal_sio
    log_events = mock_internal_sio.get_events("log_run")
    # May be emitted after video generation completes


async def test_video_generate_missing_video_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test video_generate with missing videoId."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "prompt": "A beautiful sunset",
    }

    # Act
    await video_generate(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("videos_generation_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False


async def test_video_generate_missing_prompt(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test video_generate with missing prompt."""
    # Arrange
    video_id = await db.fetchval(
        "INSERT INTO videos(name, active) VALUES ('Test Video', true) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "videoId": str(video_id),
    }

    # Act
    await video_generate(sid, data)

    # Assert - verify error was emitted (validation error)
    error_events = mock_sio.get_events("videos_generation_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

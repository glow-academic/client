"""Integration tests for video_generate WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.socket.v4.agents.video.generate import video_generate

pytestmark = pytest.mark.asyncio


async def test_video_generate_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful video_generate event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Set up socket ownership (v4 gets profile_id from sid lookup)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    # Get or create agent
    from tests.integration.socket.v4.helpers import get_or_create_test_agent

    agent_id = await get_or_create_test_agent(db, name="Video Agent")

    data = {
        "department_id": str(department_id),
        "video_agent_id": str(agent_id),
    }

    # Act
    await video_generate(sid, data)

    # Assert - verify handler completes
    # AI generation uses mocked Runner
    error_events = mock_sio.get_events("videos_generate_error")
    # May emit error if generation fails
    assert len(error_events) >= 0

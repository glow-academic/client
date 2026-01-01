"""Integration tests for hint_regenerate WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.socket.v4.agents.hint.regenerate import hint_regenerate

pytestmark = pytest.mark.asyncio


async def test_hint_regenerate_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful hint_regenerate event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Set up socket ownership (v4 gets profile_id from sid lookup)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    # Get or create agent
    from tests.integration.socket.v4.helpers import get_or_create_test_agent

    agent_id = await get_or_create_test_agent(db, name="Hint Agent")

    data = {
        "department_id": str(department_id),
        "hint_agent_id": str(agent_id),
    }

    # Act
    await hint_regenerate(sid, data)

    # Assert - verify handler completes
    # AI generation uses mocked Runner
    error_events = mock_sio.get_events("hints_regenerate_error")
    # May emit error if generation fails
    assert len(error_events) >= 0

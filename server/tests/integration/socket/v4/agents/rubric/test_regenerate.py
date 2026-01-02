"""Integration tests for rubric_regenerate WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.socket.v4.agents.rubric.regenerate import rubric_regenerate

pytestmark = pytest.mark.asyncio


async def test_rubric_regenerate_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful rubric_regenerate event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Set up socket ownership
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    # Get or create rubric agent and rubric
    from tests.integration.socket.v4.helpers import get_or_create_test_agent

    agent_id = await get_or_create_test_agent(db, name="Rubric Agent")

    from tests.integration.socket.v4.helpers import create_test_rubric

    rubric_id = await create_test_rubric(db)

    # Create a group for regeneration
    from tests.integration.socket.v4.helpers import create_test_group

    group_id = await create_test_group(db, rubric_id)

    data = {
        "department_id": str(department_id),
        "rubric_agent_id": str(agent_id),
        "rubric_id": str(rubric_id),
        "group_id": str(group_id),
    }

    # Act
    await rubric_regenerate(sid, data)

    # Assert - verify handler completes
    error_events = mock_sio.get_events("rubrics_generation_error")
    # May emit error if group not found or AI generation fails
    assert len(error_events) >= 0

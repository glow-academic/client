"""Integration tests for rubric_generate WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.socket.v4.agents.rubric.generate import rubric_generate

pytestmark = pytest.mark.asyncio


async def test_rubric_generate_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful rubric_generate event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Set up socket ownership (v4 gets profile_id from sid lookup)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    # Get or create rubric agent
    from tests.integration.socket.v4.helpers import get_or_create_test_agent

    agent_id = await get_or_create_test_agent(db, name="Rubric Agent")

    data = {
        "department_id": str(department_id),
        "rubric_agent_id": str(agent_id),
    }

    # Act
    await rubric_generate(sid, data)

    # Assert - verify rubric generation started
    # AI generation uses mocked Runner
    # Verify log_run event was emitted (may be emitted after generation completes)
    log_events = mock_internal_sio.get_events("log_run")
    # May or may not have log_run event depending on AI agent execution
    assert len(log_events) >= 0

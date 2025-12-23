"""Integration tests for simulation_messages_link internal event."""

import uuid

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.messages.link import (
    _simulation_messages_link_impl,
    simulation_messages_link_internal,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_messages_link_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_messages_link internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create test scenario and chat
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    chat_id = await db.fetchval(
        "INSERT INTO simulation_chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )

    # Create a run
    run_id = await db.fetchval(
        "INSERT INTO model_runs(operation_type, input_text_tokens, output_text_tokens) "
        "VALUES ('simulation', 100, 50) RETURNING id"
    )

    # Create system/developer messages
    system_message_id = await db.fetchval(
        "INSERT INTO simulation_messages(chat_id, content, type, completed) "
        "VALUES ($1, 'System message', 'system', true) RETURNING id",
        chat_id,
    )

    dev_message_id = await db.fetchval(
        "INSERT INTO simulation_messages(chat_id, content, type, completed) "
        "VALUES ($1, 'Developer message', 'developer', true) RETURNING id",
        chat_id,
    )

    data = {
        "run_id": str(run_id),
        "department_id": str(department_id),
        "chat_id": str(chat_id),
    }

    # Act
    await simulation_messages_link_internal(data)

    # Assert - verify messages were linked to run
    # The SQL should link system and developer messages to the run
    # Check that the linking occurred (exact check depends on SQL implementation)
    linked_messages = await db.fetch(
        "SELECT * FROM model_run_messages WHERE run_id = $1", run_id
    )
    # At least system and developer messages should be linked
    assert len(linked_messages) >= 2


async def test_simulation_messages_link_impl_direct(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test _simulation_messages_link_impl directly."""
    # Arrange
    department_id = await get_or_create_test_department(db)

    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    chat_id = await db.fetchval(
        "INSERT INTO simulation_chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )

    run_id = await db.fetchval(
        "INSERT INTO model_runs(operation_type, input_text_tokens, output_text_tokens) "
        "VALUES ('simulation', 100, 50) RETURNING id"
    )

    # Act
    result = await _simulation_messages_link_impl(
        uuid.UUID(str(run_id)),
        uuid.UUID(str(department_id)),
        uuid.UUID(str(chat_id)),
    )

    # Assert
    assert result is True


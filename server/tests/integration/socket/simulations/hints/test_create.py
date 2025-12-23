"""Integration tests for simulation_hints_create internal event."""

import uuid

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.hints.create import (
    _simulation_hints_create_impl,
    simulation_hints_create_internal,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_hints_create_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_hints_create internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create test scenario and chat
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )

    # Create a message
    message_id = await db.fetchval(
        "INSERT INTO simulation_messages(chat_id, content, type, completed) "
        "VALUES ($1, 'Test message', 'query', true) RETURNING id",
        chat_id,
    )

    data = {
        "chat_id": str(chat_id),
        "message_id": str(message_id),
        "hints": ["Hint 1", "Hint 2", "Hint 3"],
    }

    # Act
    await simulation_hints_create_internal(data)

    # Assert - verify hints were created
    hints = await db.fetch(
        "SELECT * FROM simulation_hints WHERE simulation_message_id = $1 ORDER BY idx",
        message_id,
    )
    assert len(hints) == 3
    assert hints[0]["hint"] == "Hint 1"
    assert hints[1]["hint"] == "Hint 2"
    assert hints[2]["hint"] == "Hint 3"

    # Verify event was emitted
    events = mock_sio.get_events("simulation_hints_generation_progress")
    assert len(events) == 1
    assert events[0]["type"] == "complete"
    assert events[0]["hints_count"] == 3


async def test_simulation_hints_create_empty_hints(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_hints_create with empty hints."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )

    message_id = await db.fetchval(
        "INSERT INTO simulation_messages(chat_id, content, type, completed) "
        "VALUES ($1, 'Test message', 'query', true) RETURNING id",
        chat_id,
    )

    data = {
        "chat_id": str(chat_id),
        "message_id": str(message_id),
        "hints": [],
    }

    # Act
    await simulation_hints_create_internal(data)

    # Assert - no hints should be created
    hints = await db.fetch(
        "SELECT * FROM simulation_hints WHERE simulation_message_id = $1",
        message_id,
    )
    assert len(hints) == 0


async def test_simulation_hints_create_impl_direct(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test _simulation_hints_create_impl directly."""
    # Arrange
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    chat_id = await db.fetchval(
        "INSERT INTO chats(title, scenario_id, completed, trace_id) "
        "VALUES ('Test Chat', $1, false, 'test-trace') RETURNING id",
        scenario_id,
    )

    message_id = await db.fetchval(
        "INSERT INTO simulation_messages(chat_id, content, type, completed) "
        "VALUES ($1, 'Test message', 'query', true) RETURNING id",
        chat_id,
    )

    # Act
    result = await _simulation_hints_create_impl(
        uuid.UUID(str(chat_id)),
        uuid.UUID(str(message_id)),
        ["Hint 1", "Hint 2"],
    )

    # Assert
    assert len(result) == 2


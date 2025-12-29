"""Integration tests for simulation_group_link internal event."""

import uuid

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.group.link import (
    _simulation_group_link_impl,
    simulation_group_link_internal,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_group_link_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_group_link internal event."""
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

    # Create a run
    run_id = await db.fetchval(
        "INSERT INTO model_runs(operation_type, input_text_tokens, output_text_tokens) "
        "VALUES ('simulation', 100, 50) RETURNING id"
    )

    data = {
        "chat_id": str(chat_id),
        "run_id": str(run_id),
    }

    # Act
    await simulation_group_link_internal(data)

    # Assert - verify group was created and run was linked
    group_row = await db.fetchrow(
        "SELECT * FROM simulation_groups WHERE chat_id = $1", chat_id
    )
    assert group_row is not None

    link_row = await db.fetchrow(
        "SELECT * FROM simulation_group_runs WHERE group_id = $1 AND run_id = $2",
        group_row["id"],
        run_id,
    )
    assert link_row is not None


async def test_simulation_group_link_impl_direct(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test _simulation_group_link_impl directly."""
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

    run_id = await db.fetchval(
        "INSERT INTO model_runs(operation_type, input_text_tokens, output_text_tokens) "
        "VALUES ('simulation', 100, 50) RETURNING id"
    )

    # Act
    result = await _simulation_group_link_impl(
        uuid.UUID(str(chat_id)),
        uuid.UUID(str(run_id)),
    )

    # Assert
    assert result is True
    group_row = await db.fetchrow(
        "SELECT * FROM simulation_groups WHERE chat_id = $1", chat_id
    )
    assert group_row is not None

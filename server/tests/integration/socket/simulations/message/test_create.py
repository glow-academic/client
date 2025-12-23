"""Integration tests for simulation_message_create internal event."""

import uuid

import asyncpg  # type: ignore
import pytest
from app.socket.v3.simulations.message.create import (
    _simulation_message_create_impl, simulation_message_create_internal)
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

pytestmark = pytest.mark.asyncio


async def test_simulation_message_create_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_message_create internal event."""
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
    # Create a run using the proper SQL helper
    from tests.integration.socket.helpers import get_or_create_test_model
    from utils.sql_helper import load_sql
    
    sql_create_run = load_sql("app/sql/v3/model_runs/create_model_run_complete.sql")
    # Get or create required entities
    model_id_str = await get_or_create_test_model(db)
    agent_id = await db.fetchval("SELECT id FROM agents LIMIT 1")
    if not agent_id:
        agent_id = await db.fetchval(
            "INSERT INTO agents(name, active) VALUES ('Test Agent', true) RETURNING id"
        )
    dept_id = await db.fetchval("SELECT id FROM departments WHERE active = true LIMIT 1")
    run_row = await db.fetchrow(
        sql_create_run, dept_id, model_id_str, None, "persona", profile_id, None, agent_id
    )
    run_id = run_row["run_id"] if run_row else None
    assert run_id is not None

    data = {
        "chat_id": str(chat_id),
        "message_content": "Test user message",
        "run_id": str(run_id),
    }

    # Act
    await simulation_message_create_internal(data)

    # Assert - verify message was created
    message_row = await db.fetchrow(
        "SELECT * FROM simulation_messages WHERE chat_id = $1 AND content = $2",
        chat_id,
        "Test user message",
    )
    assert message_row is not None
    assert message_row["type"] == "query"
    assert message_row["completed"] is True

    # Verify event was emitted
    events = mock_sio.get_events("simulation_new_message")
    assert len(events) == 1
    assert events[0]["content"] == "Test user message"
    assert events[0]["role"] == "user"


async def test_simulation_message_create_impl_direct(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test _simulation_message_create_impl directly."""
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

    # Create a run using the proper SQL helper
    from utils.sql_helper import load_sql
    sql_create_run = load_sql("app/sql/v3/model_runs/create_model_run_complete.sql")
    # Get or create required entities
    from tests.integration.socket.helpers import get_or_create_test_model
    
    model_id_str = await get_or_create_test_model(db)
    agent_id = await db.fetchval("SELECT id FROM agents LIMIT 1")
    if not agent_id:
        agent_id = await db.fetchval(
            "INSERT INTO agents(name, description, active) VALUES ('Test Agent', 'Test Description', true) RETURNING id"
        )
    dept_id = await db.fetchval("SELECT id FROM departments WHERE active = true LIMIT 1")
    run_row = await db.fetchrow(
        sql_create_run, dept_id, model_id_str, None, "persona", None, None, agent_id
    )
    run_id = run_row["run_id"] if run_row else None
    assert run_id is not None

    # Act
    result = await _simulation_message_create_impl(
        uuid.UUID(str(chat_id)),
        "Test message",
        uuid.UUID(str(run_id)),
    )

    # Assert
    assert result is not None
    assert "message_id" in result


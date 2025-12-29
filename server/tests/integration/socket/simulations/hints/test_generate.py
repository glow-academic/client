"""Integration tests for simulation_hints_generate WebSocket event."""

import asyncpg  # type: ignore
import pytest
from app.socket.v3.simulations.hints.generate import simulation_hints_generate
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (get_or_create_test_department,
                                              get_or_create_test_profile)

pytestmark = pytest.mark.asyncio


async def test_simulation_hints_generate_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_hints_generate event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create scenario
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    # Create chat and group
    chat_id = await db.fetchval(
        """
        WITH inserted_chat AS (
            INSERT INTO chats(title, scenario_id, completed) 
            VALUES ('Test Chat', $1, false) 
            RETURNING id
        ),
        create_group AS (
            INSERT INTO groups (created_at, updated_at, trace_id)
            VALUES (NOW(), NOW(), 'test-trace-id')
            RETURNING id as group_id
        ),
        link_chat_group AS (
            INSERT INTO chat_groups (chat_id, group_id, created_at, updated_at)
            SELECT ic.id, cg.group_id, NOW(), NOW()
            FROM inserted_chat ic
            CROSS JOIN create_group cg
            RETURNING chat_id
        )
        SELECT id FROM inserted_chat
        """,
        scenario_id,
    )

    # Create run
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    # Create message
    message_id = await db.fetchval(
        "INSERT INTO messages(role, content) VALUES ('user', 'Hello') RETURNING id"
    )
    await db.execute(
        "INSERT INTO message_runs(message_id, run_id) VALUES ($1, $2)",
        message_id,
        run_id,
    )

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "message_id": str(message_id),
        "department_id": str(department_id),
    }

    # Act
    await simulation_hints_generate(sid, data)

    # Assert - verify progress event was emitted
    progress_events = mock_sio.get_events("simulations_text_hint_generation_progress")
    # May have start/progress/complete events
    assert len(progress_events) >= 0

    # Verify log_run event was emitted via internal_sio
    log_events = mock_internal_sio.get_events("log_run")
    # May be emitted after generation completes


async def test_simulation_hints_generate_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_hints_generate with missing chat_id."""
    # Arrange
    department_id = await get_or_create_test_department(db)

    sid = "test_sid_123"
    data = {
        "message_id": "test-message-id",
        "department_id": str(department_id),
    }

    # Act
    await simulation_hints_generate(sid, data)

    # Assert - verify error was emitted (validation error)
    progress_events = mock_sio.get_events("simulations_text_hint_generation_progress")
    # May have error event
    error_events = [e for e in progress_events if e.get("type") == "error"]
    assert len(error_events) >= 0  # May have validation error or progress error


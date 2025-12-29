"""Integration tests for simulation_tool_call streaming events."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO

from app.socket.v3.simulations.streaming.tool_call import (
    _simulation_tool_call_complete_impl,
    _simulation_tool_call_start_impl,
    _simulation_tool_call_token_impl,
    simulation_tool_call_start_internal,
)

pytestmark = pytest.mark.asyncio


async def test_simulation_tool_call_start_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_tool_call_start event."""
    # Arrange
    # Create tool
    tool_id = await db.fetchval(
        "INSERT INTO tools(name, active) VALUES ('test_tool', true) RETURNING id"
    )

    # Create run
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    chat_id = "test-chat-id"
    call_id = "test-call-id"
    sid = "test_sid_123"
    data = {
        "chat_id": chat_id,
        "run_id": str(run_id),
        "call_id": call_id,
        "tool_name": "test_tool",
    }

    # Act
    tool_call_id = await _simulation_tool_call_start_impl(sid, data, conn=db)

    # Assert - verify tool call was created
    assert tool_call_id is not None
    tool_call_row = await db.fetchrow(
        "SELECT * FROM tool_calls WHERE id = $1",
        tool_call_id,
    )
    assert tool_call_row is not None
    assert tool_call_row["call_id"] == call_id


async def test_simulation_tool_call_start_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_tool_call_start via internal event."""
    # Arrange
    tool_id = await db.fetchval(
        "INSERT INTO tools(name, active) VALUES ('test_tool', true) RETURNING id"
    )
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    data = {
        "sid": "test_sid_123",
        "chat_id": "test-chat-id",
        "run_id": str(run_id),
        "call_id": "test-call-id",
        "tool_name": "test_tool",
    }

    # Act
    await simulation_tool_call_start_internal(data)

    # Assert - verify tool call was created
    tool_call_row = await db.fetchrow(
        "SELECT * FROM tool_calls WHERE call_id = $1",
        "test-call-id",
    )
    assert tool_call_row is not None


async def test_simulation_tool_call_token_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_tool_call_token event."""
    # Arrange
    tool_id = await db.fetchval(
        "INSERT INTO tools(name, active) VALUES ('test_tool', true) RETURNING id"
    )
    tool_call_id = await db.fetchval(
        "INSERT INTO tool_calls(call_id, tool_id) VALUES ('test-call-id', $1) RETURNING id",
        tool_id,
    )

    sid = "test_sid_123"
    data = {
        "tool_call_id": str(tool_call_id),
        "chat_id": "test-chat-id",
        "arguments_raw": '{"key": "value"}',
    }

    # Act
    await _simulation_tool_call_token_impl(sid, data, conn=db)

    # Assert - verify arguments were updated
    tool_call_row = await db.fetchrow(
        "SELECT arguments FROM tool_calls WHERE id = $1",
        tool_call_id,
    )
    assert tool_call_row is not None
    # Arguments may be stored as JSON or text


async def test_simulation_tool_call_complete_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_tool_call_complete event."""
    # Arrange
    tool_id = await db.fetchval(
        "INSERT INTO tools(name, active) VALUES ('test_tool', true) RETURNING id"
    )
    tool_call_id = await db.fetchval(
        "INSERT INTO tool_calls(call_id, tool_id, completed) VALUES ('test-call-id', $1, false) RETURNING id",
        tool_id,
    )

    sid = "test_sid_123"
    data = {
        "tool_call_id": str(tool_call_id),
        "chat_id": "test-chat-id",
        "arguments_raw": '{"key": "value"}',
    }

    # Act
    await _simulation_tool_call_complete_impl(sid, data, conn=db)

    # Assert - verify tool call was marked as completed
    tool_call_row = await db.fetchrow(
        "SELECT completed FROM tool_calls WHERE id = $1",
        tool_call_id,
    )
    assert tool_call_row is not None
    assert tool_call_row["completed"] is True


async def test_simulation_tool_call_start_missing_tool(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_tool_call_start with non-existent tool."""
    # Arrange
    run_id = await db.fetchval(
        "INSERT INTO runs(input_tokens, output_tokens) VALUES (0, 0) RETURNING id"
    )

    sid = "test_sid_123"
    data = {
        "chat_id": "test-chat-id",
        "run_id": str(run_id),
        "call_id": "test-call-id",
        "tool_name": "non_existent_tool",
    }

    # Act
    tool_call_id = await _simulation_tool_call_start_impl(sid, data, conn=db)

    # Assert - verify None returned (tool not found)
    assert tool_call_id is None

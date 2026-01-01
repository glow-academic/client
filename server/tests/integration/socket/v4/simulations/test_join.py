"""Integration tests for simulation_join WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO

from app.socket.v4.simulations.join import simulation_join

pytestmark = pytest.mark.asyncio


async def test_simulation_join_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_join event."""
    # Arrange
    # Create scenario
    from utils.sql_helper import execute_sql_typed
    from app.sql.types import (
        TestCreateTestScenarioV4SqlParams,
        TestCreateTestScenarioV4SqlRow,
        TestCreateTestChatV4SqlParams,
        TestCreateTestChatV4SqlRow,
    )

    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_scenario_v4_complete.sql",
        params=TestCreateTestScenarioV4SqlParams(),
    )
    scenario_id = scenario_result.scenario_id

    # Create chat
    chat_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_chat_v4_complete.sql",
        params=TestCreateTestChatV4SqlParams(scenario_id=scenario_id),
    )
    chat_id = chat_result.chat_id

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "chat_type": "assistant",
    }

    # Act
    await simulation_join(sid, data)

    # Assert - verify socket joined room
    room_name = f"assistant_{chat_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]

    # Verify event was emitted
    events = mock_sio.get_events("simulations_joined")
    assert len(events) == 1
    assert events[0]["chat_id"] == str(chat_id)
    assert events[0]["chat_type"] == "assistant"


async def test_simulation_join_custom_chat_type(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_join with custom chat_type."""
    # Arrange
    from utils.sql_helper import execute_sql_typed
    from app.sql.types import (
        TestCreateTestScenarioV4SqlParams,
        TestCreateTestScenarioV4SqlRow,
        TestCreateTestChatV4SqlParams,
        TestCreateTestChatV4SqlRow,
    )

    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_scenario_v4_complete.sql",
        params=TestCreateTestScenarioV4SqlParams(),
    )
    scenario_id = scenario_result.scenario_id

    chat_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_chat_v4_complete.sql",
        params=TestCreateTestChatV4SqlParams(scenario_id=scenario_id),
    )
    chat_id = chat_result.chat_id

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "chat_type": "simulation",
    }

    # Act
    await simulation_join(sid, data)

    # Assert - verify socket joined room with custom type
    room_name = f"simulation_{chat_id}"
    assert room_name in mock_sio.rooms
    assert sid in mock_sio.rooms[room_name]

    # Verify event was emitted
    events = mock_sio.get_events("simulations_joined")
    assert len(events) == 1
    assert events[0]["chat_type"] == "simulation"


async def test_simulation_join_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_join with missing chat_id."""
    # Arrange
    sid = "test_sid_123"
    data = {
        "chat_type": "assistant",
    }

    # Act
    await simulation_join(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_join_error")
    assert len(error_events) >= 1


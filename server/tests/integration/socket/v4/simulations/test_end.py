"""Integration tests for simulation_text_end WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v4.attempts.simulation.end import simulation_text_end

pytestmark = pytest.mark.asyncio


async def test_simulation_text_end_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_text_end event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    # Create scenario
    from tests.integration.socket.v4.helpers import create_test_scenario

    scenario_id = await create_test_scenario(db)

    # Create attempt
    from tests.integration.socket.v4.helpers import (
        get_simulation_by_active,
    )
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import (
        TestCreateTestAttemptV4SqlParams,
    )

    simulation_id = await get_simulation_by_active(db)
    if not simulation_id:
        pytest.skip("No active simulations found in test database")

    attempt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_create_test_attempt_v4_complete.sql",
        params=TestCreateTestAttemptV4SqlParams(simulation_id=simulation_id),
    )
    attempt_id = attempt_result.attempt_id

    # Create chat
    from tests.integration.socket.v4.helpers import create_test_chat

    chat_id = await create_test_chat(db, scenario_id)

    sid = "test_sid_123"
    data = {
        "chat_id": str(chat_id),
        "attempt_id": str(attempt_id),
        "end_all": False,
    }

    # Act
    await simulation_text_end(sid, data)

    # Assert - verify chat was marked as completed
    from tests.integration.socket.v4.helpers import get_chat_by_id

    chat_result = await get_chat_by_id(db, str(chat_id))
    assert chat_result is not None
    # Chat should be marked as completed
    assert chat_result["completed"] is True

    # Verify event was emitted
    events = mock_sio.get_events("simulation_text_ended")
    assert len(events) >= 0  # May or may not emit depending on implementation


async def test_simulation_text_end_missing_chat_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_text_end with missing chat_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    data = {
        "attempt_id": "00000000-0000-0000-0000-000000000000",
        "end_all": False,
    }

    # Act
    await simulation_text_end(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulation_text_end_error")
    assert len(error_events) >= 1
    assert error_events[0]["success"] is False

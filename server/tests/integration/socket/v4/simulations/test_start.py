"""Integration tests for simulation_start WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO
from tests.integration.socket.v4.helpers import get_or_create_test_profile

from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.socket.v4.simulations.start import simulation_start

pytestmark = pytest.mark.asyncio


async def test_start_simulation_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful simulation start."""
    profile_id = await get_or_create_test_profile(db)

    # Set up socket ownership (v4 gets profile_id from sid lookup)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    # Get a simulation_id
    from tests.integration.socket.v4.helpers import get_simulation_by_active

    simulation_id = await get_simulation_by_active(db)
    if not simulation_id:
        pytest.skip("No active simulations found in test database")

    data = {
        "simulation_id": simulation_id,
    }

    await simulation_start(sid, data)

    # Verify events were emitted
    started_events = mock_sio.get_events("simulations_started")
    assert len(started_events) == 1
    assert started_events[0]["success"] is True
    assert "attempt_id" in started_events[0]

    # Verify attempt was created in database
    from utils.sql_helper import execute_sql_typed

    from app.sql.types import (
        TestGetAttemptByIdV4SqlParams,
    )

    attempt_id = started_events[0]["attempt_id"]
    attempt_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/socket/helpers/test_get_attempt_by_id_v4_complete.sql",
        params=TestGetAttemptByIdV4SqlParams(attempt_id=attempt_id),
    )
    assert attempt_result.id is not None


async def test_start_simulation_missing_simulation_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test start_simulation with missing simulation_id."""
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    await set_socket_owner(profile_id, sid)

    data = {}

    await simulation_start(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("simulations_start_error")
    assert len(error_events) >= 1

    # Verify no attempt was created
    started_events = mock_sio.get_events("simulations_started")
    assert len(started_events) == 0


async def test_start_simulation_missing_profile(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test start_simulation with missing profile (no socket ownership)."""
    # Get a simulation_id
    from tests.integration.socket.v4.helpers import get_simulation_by_active

    simulation_id = await get_simulation_by_active(db)
    if not simulation_id:
        pytest.skip("No active simulations found in test database")

    sid = "test_sid_123"
    # Don't set socket ownership - profile should not be found
    data = {
        "simulation_id": simulation_id,
    }

    await simulation_start(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("simulations_start_error")
    assert len(error_events) >= 1

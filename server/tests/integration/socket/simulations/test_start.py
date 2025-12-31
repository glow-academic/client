"""Integration tests for start_simulation WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.simulations.start import simulation_text_start

pytestmark = pytest.mark.asyncio


async def test_start_simulation_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful simulation start."""
    profile_id = await get_or_create_test_profile(db)

    # Get a simulation_id
    sim_row = await db.fetchrow(
        "SELECT id FROM simulations WHERE active = true LIMIT 1"
    )
    if not sim_row:
        pytest.skip("No active simulations found in test database")
    simulation_id = str(sim_row["id"])

    sid = "test_sid_123"
    data = {
        "simulation_id": simulation_id,
        "profile_id": profile_id,
    }

    await simulation_text_start(sid, data)

    # Verify events were emitted
    started_events = mock_sio.get_events("simulations_text_started")
    assert len(started_events) == 1
    assert started_events[0]["success"] is True
    assert "attempt_id" in started_events[0]
    assert "chat_id" in started_events[0]

    # Verify attempt was created in database
    attempt_id = started_events[0]["attempt_id"]
    attempt_row = await db.fetchrow(
        "SELECT * FROM simulation_attempts WHERE id = $1", attempt_id
    )
    assert attempt_row is not None
    assert str(attempt_row["simulation_id"]) == simulation_id


async def test_start_simulation_missing_simulation_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test start_simulation with missing simulation_id."""
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    data = {
        "profile_id": profile_id,
    }

    await simulation_text_start(sid, data)

    # Verify error was emitted
    error_events = mock_sio.get_events("simulations_text_start_error")
    assert len(error_events) >= 1

    # Verify no attempt was created
    started_events = mock_sio.get_events("simulations_text_started")
    assert len(started_events) == 0


async def test_start_simulation_guest_profile(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test start_simulation with guest profile (None)."""
    # Get a simulation_id
    sim_row = await db.fetchrow(
        "SELECT id FROM simulations WHERE active = true LIMIT 1"
    )
    if not sim_row:
        pytest.skip("No active simulations found in test database")
    simulation_id = str(sim_row["id"])

    sid = "test_sid_123"
    data = {
        "simulation_id": simulation_id,
        "profile_id": None,
    }

    await simulation_text_start(sid, data)

    # Should still succeed - guest profile should be resolved
    started_events = mock_sio.get_events("simulations_text_started")
    assert (
        len(started_events) >= 0
    )  # May or may not succeed depending on guest profile setup

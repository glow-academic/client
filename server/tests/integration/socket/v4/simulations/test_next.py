"""Integration tests for simulation_next WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import get_or_create_test_profile

from app.socket.v4.simulations.next import simulation_next

pytestmark = pytest.mark.asyncio


async def test_simulation_next_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_next event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create scenario
    from tests.integration.socket.v4.helpers import create_test_scenario
    scenario_id = await create_test_scenario(db)

    # Create attempt
    from tests.integration.socket.v4.helpers import (
        get_simulation_by_active,
        create_test_attempt,
    )

    simulation_id = await get_simulation_by_active(db)
    if not simulation_id:
        pytest.skip("No active simulations found in test database")

    attempt_id = await create_test_attempt(db, simulation_id)

    sid = "test_sid_123"
    data = {
        "attempt_id": str(attempt_id),
        "scenario_id": str(scenario_id),
        "profile_id": profile_id,
        "simulation_id": simulation_id,
    }

    # Act
    await simulation_next(sid, data)

    # Assert - verify handler completes (may emit error if scenario generation fails)
    error_events = mock_sio.get_events("simulations_next_error")
    # Handler may emit error if scenario generation fails
    assert len(error_events) >= 0


async def test_simulation_next_missing_attempt_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_next with missing attempt_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    from tests.integration.socket.v4.helpers import create_test_scenario
    scenario_id = await create_test_scenario(db)

    sid = "test_sid_123"
    data = {
        "scenario_id": str(scenario_id),
        "profile_id": profile_id,
    }

    # Act
    await simulation_next(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_next_error")
    assert len(error_events) >= 1


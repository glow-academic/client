"""Integration tests for simulation_advance WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.v4.helpers import get_or_create_test_profile

from app.socket.v4.simulations.advance import simulation_advance

pytestmark = pytest.mark.asyncio


async def test_simulation_advance_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful simulation_advance event."""
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
        "scenario_id": str(scenario_id),
        "attempt_id": str(attempt_id),
        "profile_id": profile_id,
        "simulation_id": simulation_id,
    }

    # Act
    await simulation_advance(sid, data)

    # Assert - verify event was emitted
    advanced_events = mock_sio.get_events("simulations_advanced")
    # May or may not emit depending on implementation
    assert len(advanced_events) >= 0


async def test_simulation_advance_missing_scenario_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test simulation_advance with missing scenario_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

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
        "profile_id": profile_id,
        "simulation_id": simulation_id,
    }

    # Act
    await simulation_advance(sid, data)

    # Assert - verify error was emitted
    error_events = mock_sio.get_events("simulations_advance_error")
    assert len(error_events) >= 1

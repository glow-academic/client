"""Integration tests for scenario_image_link internal event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

# TODO: scenario_image_link functions may have been refactored - verify actual location
# from app.socket.v3.agents.scenario.tools.image.call import (
#     _scenario_image_link_impl,
#     scenario_image_link_internal,
# )

pytestmark = pytest.mark.asyncio


async def test_scenario_image_link_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful scenario_image_link event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create scenario
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    # Create image
    image_id = await db.fetchval(
        "INSERT INTO images(name, active) VALUES ('Test Image', true) RETURNING id"
    )

    # Act - call internal implementation directly
    result = await _scenario_image_link_impl(
        scenario_id, image_id, True, "test_sid_123"
    )

    # Assert - verify link was created
    assert result is True
    link_row = await db.fetchrow(
        "SELECT * FROM scenario_images WHERE scenario_id = $1 AND image_id = $2",
        scenario_id,
        image_id,
    )
    assert link_row is not None
    assert link_row["active"] is True


async def test_scenario_image_link_internal_event(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_image_link via internal event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create scenario
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    # Create image
    image_id = await db.fetchval(
        "INSERT INTO images(name, active) VALUES ('Test Image', true) RETURNING id"
    )

    # Act - emit internal event
    data = {
        "scenario_id": str(scenario_id),
        "image_id": str(image_id),
        "active": True,
        "sid": "test_sid_123",
    }
    await scenario_image_link_internal(data)

    # Assert - verify link was created
    link_row = await db.fetchrow(
        "SELECT * FROM scenario_images WHERE scenario_id = $1 AND image_id = $2",
        scenario_id,
        image_id,
    )
    assert link_row is not None
    assert link_row["active"] is True


async def test_scenario_image_link_inactive(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test scenario_image_link with active=False."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    # Create scenario
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )

    # Create image
    image_id = await db.fetchval(
        "INSERT INTO images(name, active) VALUES ('Test Image', true) RETURNING id"
    )

    # Act
    result = await _scenario_image_link_impl(
        scenario_id, image_id, False, "test_sid_123"
    )

    # Assert - verify link was created with active=False
    assert result is True
    link_row = await db.fetchrow(
        "SELECT * FROM scenario_images WHERE scenario_id = $1 AND image_id = $2",
        scenario_id,
        image_id,
    )
    assert link_row is not None
    assert link_row["active"] is False

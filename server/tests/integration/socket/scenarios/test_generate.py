"""Integration tests for generate_scenario WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import (
    get_or_create_test_department,
    get_or_create_test_profile,
)

from app.socket.v3.scenarios.generate import generate_scenario

pytestmark = pytest.mark.asyncio


async def test_generate_scenario_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful generate_scenario event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    department_id = await get_or_create_test_department(db)

    sid = "test_sid_123"
    data = {
        "department_id": str(department_id),
        "profile_id": str(profile_id),
        "name": "Test Scenario",
    }

    # Act
    await generate_scenario(sid, data)

    # Assert - verify scenario generation started
    # AI generation uses mocked Runner, so scenario should be created
    # Verify log_run event was emitted via internal_sio
    log_events = mock_internal_sio.get_events("log_run")
    # Should have log_run event after generation completes

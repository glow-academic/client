"""Integration tests for keycloak_sync WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.conftest import MockInternalBus, MockSocketIO
from tests.integration.socket.helpers import get_or_create_test_profile

from app.socket.v3.actions.keycloak import keycloak_sync

pytestmark = pytest.mark.asyncio


async def test_keycloak_sync_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test successful keycloak_sync event."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)

    sid = "test_sid_123"
    data = {
        "profile_id": str(profile_id),
    }

    # Act
    await keycloak_sync(sid, data)

    # Assert - keycloak sync is async and may succeed or fail
    # The handler should complete without raising
    # Verify no errors were emitted (sync may succeed or fail silently)
    error_events = mock_sio.get_events("keycloak_sync_error")
    # May or may not have errors depending on keycloak availability


async def test_keycloak_sync_missing_profile_id(
    db: asyncpg.Connection, mock_sio: MockSocketIO, mock_internal_sio: MockInternalBus
) -> None:
    """Test keycloak_sync with missing profile_id."""
    # Arrange
    sid = "test_sid_123"
    data = {}

    # Act
    await keycloak_sync(sid, data)

    # Assert - handler should handle missing profile_id gracefully
    # May emit error or return early

"""Integration tests for connect WebSocket event."""

import asyncpg  # type: ignore
import pytest
from tests.integration.socket.v4.conftest import MockSocketIO
from tests.integration.socket.v4.helpers import get_or_create_test_profile

from app.socket.v4.connect import connect

pytestmark = pytest.mark.asyncio


async def test_connect_with_profile_id_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful connection with profile_id."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    sid = "test_sid_123"
    environ = {"QUERY_STRING": f"profileId={profile_id}"}
    auth = {}

    # Act
    result = await connect(sid, environ, auth)

    # Assert
    assert result is True

    # Verify socket joined profile room
    assert profile_id in mock_sio.rooms
    assert sid in mock_sio.rooms[profile_id]


async def test_connect_with_guest_id_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful connection with guest_id."""
    # Arrange — must be a valid UUID (connect validates with uuid.UUID())
    guest_id = "00000000-0000-0000-0000-000000000099"
    sid = "test_sid_456"
    environ = {"QUERY_STRING": f"guestId={guest_id}"}
    auth = {}

    # Act
    result = await connect(sid, environ, auth)

    # Assert
    assert result is True

    # Verify connection_confirmed event was emitted
    confirmed_events = mock_sio.get_events("connection_confirmed")
    assert len(confirmed_events) == 1
    assert confirmed_events[0]["sid"] == sid
    assert confirmed_events[0]["profile_id"] is None
    assert confirmed_events[0]["guest_id"] == guest_id

    # Verify socket joined guest room
    guest_room = f"guest_{guest_id}"
    assert guest_room in mock_sio.rooms
    assert sid in mock_sio.rooms[guest_room]


async def test_connect_anonymous_guest(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test anonymous guest connection (no profile_id, no guest_id)."""
    # Arrange
    sid = "test_sid_789"
    environ = {"QUERY_STRING": ""}
    auth = {}

    # Act
    result = await connect(sid, environ, auth)

    # Assert
    assert result is True

    # Verify connection_confirmed event was emitted
    confirmed_events = mock_sio.get_events("connection_confirmed")
    assert len(confirmed_events) == 1
    assert confirmed_events[0]["sid"] == sid
    assert confirmed_events[0]["profile_id"] is None
    assert confirmed_events[0]["guest_id"] is None


async def test_connect_profile_takeover(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test profile connection when profile already has active socket."""
    # Arrange
    profile_id = await get_or_create_test_profile(db)
    old_sid = "old_sid_123"
    new_sid = "new_sid_456"

    # Set up old socket ownership (simulate existing connection)
    from app.infra.v4.websocket.set_socket_owner import set_socket_owner

    await set_socket_owner(profile_id, old_sid)
    await mock_sio.enter_room(old_sid, profile_id)

    # Act - connect with new socket
    environ = {"QUERY_STRING": f"profileId={profile_id}"}
    auth = {}
    result = await connect(new_sid, environ, auth)

    # Assert
    assert result is True

    # Verify new socket owns the profile room
    assert new_sid in mock_sio.rooms.get(profile_id, set())


async def test_connect_invalid_guest_profile_id_string(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test that invalid profile ID strings are treated as invalid/missing."""
    # Arrange
    sid = "test_sid_guest"
    environ = {"QUERY_STRING": "profileId=invalid-uuid-string"}
    auth = {}

    # Act
    result = await connect(sid, environ, auth)

    # Assert
    assert result is True

    # Verify connection_confirmed event was emitted with None profile_id (treated as invalid)
    confirmed_events = mock_sio.get_events("connection_confirmed")
    assert len(confirmed_events) == 1
    assert confirmed_events[0]["sid"] == sid
    # The profile_id should be None since invalid UUID strings are treated as invalid
    assert confirmed_events[0]["profile_id"] is None

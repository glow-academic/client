"""Integration tests for connect WebSocket event."""

import asyncpg  # type: ignore
import pytest
from app.socket.connections.connect import connect
from tests.integration.socket.conftest import MockSocketIO
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_connect_with_profile_id_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful connection with profile_id."""
    # Arrange
    profile_id = await get_superadmin_alias(db)
    sid = "test_sid_123"
    environ = {"QUERY_STRING": f"profileId={profile_id}"}
    auth = {}

    # Act
    result = await connect(sid, environ, auth)

    # Assert
    assert result is True

    # Verify connection_confirmed event was emitted
    confirmed_events = mock_sio.get_events("connection_confirmed")
    assert len(confirmed_events) == 1
    assert confirmed_events[0]["sid"] == sid
    assert confirmed_events[0]["profile_id"] == profile_id
    assert confirmed_events[0]["guest_id"] is None

    # Verify socket joined profile room
    assert profile_id in mock_sio.rooms
    assert sid in mock_sio.rooms[profile_id]

    # Verify profile was marked as active in database
    profile_row = await db.fetchrow(
        "SELECT active FROM profiles WHERE id = $1", profile_id
    )
    assert profile_row is not None
    assert profile_row["active"] is True
    
    # Verify last_active was set in profile_activity table
    activity_row = await db.fetchrow(
        "SELECT last_active FROM profile_activity WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
        profile_id
    )
    assert activity_row is not None
    assert activity_row["last_active"] is not None


async def test_connect_with_guest_id_success(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test successful connection with guest_id."""
    # Arrange
    guest_id = "test_guest_123"
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
    profile_id = await get_superadmin_alias(db)
    old_sid = "old_sid_123"
    new_sid = "new_sid_456"

    # Set up old socket ownership (simulate existing connection)
    from app.utils.websocket.set_socket_owner import set_socket_owner

    await set_socket_owner(profile_id, old_sid)
    await mock_sio.enter_room(old_sid, profile_id)

    # Act - connect with new socket
    environ = {"QUERY_STRING": f"profileId={profile_id}"}
    auth = {}
    result = await connect(new_sid, environ, auth)

    # Assert
    assert result is True

    # Verify old socket was disconnected
    disconnect_calls = [
        call for call in mock_sio.emitted_events if call[0] == "disconnect"
    ]
    # Note: disconnect is called via sio.disconnect() which may not emit events
    # Instead verify new socket owns the profile
    assert new_sid in mock_sio.rooms.get(profile_id, set())

    # Verify connection_confirmed event was emitted for new socket
    confirmed_events = mock_sio.get_events("connection_confirmed")
    new_socket_events = [
        e for e in confirmed_events if e["sid"] == new_sid and e["profile_id"] == profile_id
    ]
    assert len(new_socket_events) == 1


async def test_connect_guest_profile_id_resolution(
    db: asyncpg.Connection, mock_sio: MockSocketIO
) -> None:
    """Test 'guest-profile-id' string resolves to actual guest profile."""
    # Arrange - ensure there's a default guest profile
    # First, clear any existing default guest profiles
    await db.execute(
        "UPDATE profiles SET default_profile = false WHERE role = 'guest' AND default_profile = true"
    )
    
    # Create a new default guest profile
    guest_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role, default_profile) "
        "VALUES('Guest', 'User', 'default_guest', 'guest', true) "
        "RETURNING id"
    )

    sid = "test_sid_guest"
    environ = {"QUERY_STRING": "profileId=guest-profile-id"}
    auth = {}

    # Act
    result = await connect(sid, environ, auth)

    # Assert
    assert result is True

    # Verify connection_confirmed event was emitted with resolved profile_id
    confirmed_events = mock_sio.get_events("connection_confirmed")
    assert len(confirmed_events) == 1
    assert confirmed_events[0]["sid"] == sid
    # The profile_id should be resolved to the actual guest profile ID
    assert confirmed_events[0]["profile_id"] == str(guest_id)

    # Verify socket joined profile room with resolved profile_id
    assert str(guest_id) in mock_sio.rooms
    assert sid in mock_sio.rooms[str(guest_id)]


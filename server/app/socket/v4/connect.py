"""Handler for connect WebSocket event."""

import time
import uuid
from typing import cast
from urllib.parse import parse_qs

from fastapi import APIRouter
from pydantic import BaseModel
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.add_guest_socket import add_guest_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.get_socket_owner import get_socket_owner
from app.infra.v4.websocket.increment_guest_count import increment_guest_count
from app.infra.v4.websocket.remove_socket_owner import remove_socket_owner
from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.main import sio
from app.sql.types import (
    UpdateProfileToActiveSqlParams,
    UpdateProfileToActiveSqlRow,
    UpdateProfileToInactiveSqlParams,
    UpdateProfileToInactiveSqlRow,
)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class ConnectionConfirmedPayload(BaseModel):
    """Response indicating WebSocket connection was confirmed."""

    sid: str
    profile_id: str | None
    guest_id: str | None
    server_time: float


# Emit helper functions (imported by server/connect.py)
async def connection_confirmed(payload: ConnectionConfirmedPayload, room: str) -> None:
    await sio.emit("connection_confirmed", payload.model_dump(), room=room)


@sio.event  # type: ignore
async def connect(
    sid: str, environ: dict[str, str], auth: dict[str, str] | None
) -> bool:
    """Handle WebSocket connection with robust, profile-based socket management."""
    query_string = environ.get("QUERY_STRING", "")
    profile_id: str | None = None
    guest_id: str | None = None

    session_id: str | None = None

    # Parse query string using urllib.parse for proper URL decoding
    try:
        params = parse_qs(query_string)
        profile_id = params.get("profileId", [None])[0]
        guest_id = params.get("guestId", [None])[0]
        session_id = params.get("sessionId", [None])[0]
    except Exception:  # defensive; ignore malformed
        pass

    # Validate IDs to avoid storing invalid identifiers in Redis/rooms
    if profile_id:
        try:
            uuid.UUID(profile_id)
        except ValueError:
            profile_id = None

    if guest_id:
        try:
            uuid.UUID(guest_id)
        except ValueError:
            guest_id = None
    if profile_id:
        # Check if another socket is already active for this profile
        old_sid = await get_socket_owner(profile_id)
        if old_sid and old_sid != sid:
            # Clean up the entire old session for this profile
            # Remove from socket ownership using Redis
            await remove_socket_owner(profile_id)
            # Update database to mark profile as inactive
            try:
                from datetime import UTC, datetime

                async with get_db_connection() as conn:
                    async with conn.transaction():
                        params = UpdateProfileToInactiveSqlParams(
                            profile_id=uuid.UUID(profile_id),
                            last_active=datetime.now(UTC).isoformat(),
                        )
                        await cast(
                            UpdateProfileToInactiveSqlRow,
                            execute_sql_typed(
                                conn,
                                "app/sql/v4/queries/profile/update_profile_to_inactive_complete.sql",
                                params=params,
                            ),
                        )
            except RuntimeError:
                # Database pool not initialized - Socket.IO handles logging
                pass
            except Exception:
                # Error updating profile - Socket.IO handles logging
                pass
            # Forcefully disconnect the old socket from the server-side
            await sio.disconnect(old_sid)

        # Store socket ownership
        await set_socket_owner(profile_id, sid)
        await sio.enter_room(sid, profile_id)

        # Store session_id in Redis for WebSocket activity logging
        if session_id:
            try:
                from app.main import get_redis_client
                redis_client = get_redis_client()
                if redis_client:
                    await redis_client.setex(f"socket_session:{sid}", 86400, session_id)
            except Exception:
                pass

        # Update database to mark profile as active
        try:
            from datetime import UTC, datetime

            async with get_db_connection() as conn:
                async with conn.transaction():
                    params = UpdateProfileToActiveSqlParams(
                        profile_id=uuid.UUID(profile_id),
                        last_active=datetime.now(UTC).isoformat(),
                    )
                    await cast(
                        UpdateProfileToActiveSqlRow,
                        execute_sql_typed(
                            conn,
                            "app/sql/v4/queries/profile/update_profile_to_active_complete.sql",
                            params=params,
                        ),
                    )
        except RuntimeError:
            # Database pool not initialized - Socket.IO handles logging
            pass
        except Exception:
            # Error updating profile - Socket.IO handles logging
            pass
    else:
        # Guest connection (no profile). Optionally join a guest room for targeted emits.
        if guest_id:
            await sio.enter_room(sid, f"guest_{guest_id}")
            # Track guest connection
            try:
                await add_guest_socket(sid)
                # Increment guest connection counter
                await increment_guest_count()
            except Exception:
                # Error adding guest - Socket.IO handles logging
                pass
        else:
            pass
        await connection_confirmed(
            ConnectionConfirmedPayload(
                sid=sid,
                profile_id=profile_id,
                guest_id=guest_id,
                server_time=time.time(),
            ),
            room=sid,
        )
    # Log activity (after set_socket_owner so find_profile_by_socket works)
    try:
        await log_websocket_activity(
            sid=sid,
            event_key="websocket.connected",
            template="{{ actor.name }} connected to WebSocket",
            context={},
            endpoint="/socket/v4/connect",
            error=False,
        )
    except Exception:
        # Error logging activity - Socket.IO handles logging
        pass
    return True


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/connect")
async def connect_api() -> dict[str, bool]:
    """Client-to-server lifecycle event: Establish WebSocket connection."""
    return {"success": True}


@server_router.post("/connection_confirmed", response_model=dict[str, bool])
async def connection_confirmed_api(
    request: ConnectionConfirmedPayload,
) -> dict[str, bool]:
    """Server-to-client event: Connection confirmed after WebSocket establishment."""
    return {"success": True}

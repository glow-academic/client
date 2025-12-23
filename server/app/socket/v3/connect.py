"""Handler for connect WebSocket event."""

import time
from urllib.parse import parse_qs

from app.infra.activity.websocket_logger import log_websocket_activity
from app.infra.websocket.add_guest_socket import add_guest_socket
from app.infra.websocket.get_socket_owner import get_socket_owner
from app.infra.websocket.increment_guest_count import increment_guest_count
from app.infra.websocket.remove_socket_owner import remove_socket_owner
from app.infra.websocket.set_socket_owner import set_socket_owner
from app.main import get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter
from pydantic import BaseModel

logger = get_logger(__name__)

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

    # Parse query string using urllib.parse for proper URL decoding
    try:
        params = parse_qs(query_string)
        profile_id = params.get("profileId", [None])[0]
        guest_id = params.get("guestId", [None])[0]
    except Exception:  # defensive; ignore malformed
        pass

    logger.info(
        f"Client connecting: sid={sid}, profile_id={profile_id}, guest_id={guest_id}"
    )

    if profile_id:
        # Check if another socket is already active for this profile
        old_sid = await get_socket_owner(profile_id)
        if old_sid and old_sid != sid:
            logger.warning(
                f"Profile {profile_id} already has active socket {old_sid}. "
                f"Closing old connection and accepting new one {sid}."
            )
            # Clean up the entire old session for this profile
            logger.info(f"Cleaning up profile {profile_id} connections - new socket takeover")
            # Remove from socket ownership using Redis
            await remove_socket_owner(profile_id)
            # Update database to mark profile as inactive
            try:
                from datetime import UTC, datetime

                pool = get_pool()
                if pool:
                    async with pool.acquire() as conn:
                        async with conn.transaction():
                            sql = load_sql(
                                "sql/v3/profile/update_profile_to_inactive_complete.sql"
                            )
                            last_active = datetime.now(UTC)
                            await conn.fetchrow(sql, profile_id, last_active)
                    logger.info(f"Updated profile {profile_id} to inactive in database")
            except Exception as e:
                logger.error(f"Error updating profile {profile_id} in database: {e}")
            # Forcefully disconnect the old socket from the server-side
            await sio.disconnect(old_sid)

        # Store socket ownership
        await set_socket_owner(profile_id, sid)
        await sio.enter_room(sid, profile_id)

        # Update database to mark profile as active
        try:
            from datetime import UTC, datetime

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        sql = load_sql(
                            "sql/v3/profile/update_profile_to_active_complete.sql"
                        )
                        last_active = datetime.now(UTC)
                        await conn.fetchrow(sql, profile_id, last_active)
                logger.info(f"Updated profile {profile_id} to active in database")
        except Exception as e:
            logger.error(f"Error updating profile {profile_id} in database: {e}")
    else:
        # Guest connection (no profile). Optionally join a guest room for targeted emits.
        if guest_id:
            await sio.enter_room(sid, f"guest_{guest_id}")
            logger.info(f"Guest {guest_id} joined room guest_{guest_id}")
            # Track guest connection and update default guest profile activity
            try:
                await add_guest_socket(sid)
                # Increment guest connection counter
                await increment_guest_count()
            except Exception as e:
                logger.error(f"Error adding guest socket: {e}")
        else:
            logger.info("Anonymous guest connection with no guest_id; broadcasts only.")

    await connection_confirmed(
        ConnectionConfirmedPayload(
            sid=sid,
            profile_id=profile_id,
            guest_id=guest_id,
            server_time=time.time(),
        ),
        room=sid,
    )

    logger.info(
        f"Client connected successfully: sid={sid}, profile_id={profile_id}, guest_id={guest_id}"
    )

    # Log activity (after set_socket_owner so find_profile_by_socket works)
    try:
        await log_websocket_activity(
            sid=sid,
            event_key="websocket.connected",
            template="{{ actor.name }} connected to WebSocket",
            context={},
            endpoint="/socket/v3/connect",
            error=False,
        )
    except Exception as e:
        logger.warning(f"Error logging WebSocket connect activity: {e}")

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

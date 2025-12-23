"""Handler for disconnect WebSocket event."""

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.websocket.decrement_guest_count import decrement_guest_count
from app.infra.v3.websocket.find_chats_by_socket import find_chats_by_socket
from app.infra.v3.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v3.websocket.is_guest_socket import is_guest_socket
from app.infra.v3.websocket.remove_active_connection import \
    remove_active_connection
from app.infra.v3.websocket.remove_guest_socket import remove_guest_socket
from app.infra.v3.websocket.remove_socket_owner import remove_socket_owner
from app.main import sio
from fastapi import APIRouter
from utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection with immediate cleanup"""
    logger.info(f"Client disconnecting: {sid}")

    # Find and clean up profile for this socket
    # Find and clean up profile for this socket using Redis
    profile_to_cleanup = await find_profile_by_socket(sid)

    if profile_to_cleanup:
        logger.info(f"Cleaning up profile {profile_to_cleanup} connections - socket disconnect")
        # Remove from socket ownership using Redis
        await remove_socket_owner(profile_to_cleanup)
        # Update database to mark profile as inactive
        try:
            from datetime import UTC, datetime

            from app.main import get_pool
            from utils.sql_helper import load_sql

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        sql = load_sql(
                            "sql/v3/profile/update_profile_to_inactive_complete.sql"
                        )
                        last_active = datetime.now(UTC)
                        await conn.fetchrow(sql, profile_to_cleanup, last_active)
                logger.info(f"Updated profile {profile_to_cleanup} to inactive in database")
        except Exception as e:
            logger.error(f"Error updating profile {profile_to_cleanup} in database: {e}")

    # If this was a guest connection, update counter
    if await is_guest_socket(sid):
        try:
            await remove_guest_socket(sid)
            # Decrement guest count
            await decrement_guest_count()
        except Exception as e:
            logger.error(f"Error removing guest socket: {e}")

    # Remove from all active connections using Redis
    chat_ids = await find_chats_by_socket(sid)
    for chat_id in chat_ids:
        await remove_active_connection(chat_id)

    # Log activity (before cleanup, so find_profile_by_socket still works)
    try:
        await log_websocket_activity(
            sid=sid,
            event_key="websocket.disconnected",
            template="{{ actor.name }} disconnected from WebSocket",
            context={},
            endpoint="/socket/v3/disconnect",
            error=False,
        )
    except Exception as e:
        logger.warning(f"Error logging WebSocket disconnect activity: {e}")


# FastAPI endpoint for OpenAPI documentation (disconnect is a lifecycle event, no request payload)
@client_router.post("/disconnect")
async def disconnect_api() -> dict[str, bool]:
    """Client-to-server lifecycle event: Close WebSocket connection."""
    return {"success": True}

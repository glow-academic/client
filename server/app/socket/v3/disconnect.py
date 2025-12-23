"""Handler for disconnect WebSocket event."""

from fastapi import APIRouter

from app.main import sio
from app.utils.activity.websocket_logger import log_websocket_activity
from app.utils.logging.db_logger import get_logger
from app.utils.websocket.remove_socket_owner import remove_socket_owner
from app.utils.websocket.decrement_guest_count import decrement_guest_count
from app.utils.websocket.find_chats_by_socket import find_chats_by_socket
from app.utils.websocket.find_profile_by_socket import find_profile_by_socket
from app.utils.websocket.is_guest_socket import is_guest_socket
from app.utils.websocket.remove_active_connection import remove_active_connection
from app.utils.websocket.remove_guest_socket import remove_guest_socket

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

    # If this was a guest connection, update counter and default guest profile activity
    if await is_guest_socket(sid):
        try:
            await remove_guest_socket(sid)
            # Decrement guest count and get remaining count
            remaining_guests = await decrement_guest_count()

            from datetime import UTC, datetime

            from app.main import get_pool
            from app.utils.sql_helper import load_sql

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        # Update default guest profile: refresh last_active, set active False only when all guests are gone
                        sql = load_sql(
                            "sql/v3/profile/update_default_guest_profile_activity_complete.sql"
                        )
                        await conn.fetchrow(
                            sql, datetime.now(UTC), remaining_guests > 0
                        )
                    logger.info(
                        f"Updated default guest profile activity on disconnect (remaining guests: {remaining_guests})"
                    )
        except Exception as e:
            logger.error(
                f"Error updating default guest profile activity on disconnect: {e}"
            )

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

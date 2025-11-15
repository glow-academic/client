"""Handler for disconnect WebSocket event."""

import logging

from app.main import sio
from app.web.connections.utils import (cleanup_profile_connection,
                                       decrement_guest_count,
                                       find_chats_by_socket,
                                       find_profile_by_socket, is_guest_socket,
                                       remove_active_connection,
                                       remove_guest_socket)

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection with immediate cleanup"""
    logger.info(f"Client disconnecting: {sid}")

    # Find and clean up profile for this socket
    # Find and clean up profile for this socket using Redis
    profile_to_cleanup = await find_profile_by_socket(sid)

    if profile_to_cleanup:
        await cleanup_profile_connection(profile_to_cleanup, "socket disconnect")

    # If this was a guest connection, update counter and default guest profile activity
    if await is_guest_socket(sid):
        try:
            await remove_guest_socket(sid)
            # Decrement guest count and get remaining count
            remaining_guests = await decrement_guest_count()

            from datetime import UTC, datetime

            from app.db import get_pool
            from app.utils.sql_helper import load_sql

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        # Update default guest profile: refresh last_active, set active False only when all guests are gone
                        sql = load_sql("sql/v3/profile/update_default_guest_profile_activity_complete.sql")
                        await conn.fetchrow(sql, datetime.now(UTC), remaining_guests > 0)
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


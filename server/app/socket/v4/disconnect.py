"""Handler for disconnect WebSocket event."""

import uuid
from typing import cast

from fastapi import APIRouter
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.decrement_guest_count import decrement_guest_count
from app.infra.v4.websocket.find_chats_by_socket import find_chats_by_socket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.is_guest_socket import is_guest_socket
from app.infra.v4.websocket.remove_active_connection import remove_active_connection
from app.infra.v4.websocket.remove_guest_socket import remove_guest_socket
from app.infra.v4.websocket.remove_socket_owner import remove_socket_owner
from app.main import sio
from app.sql.types import (
    UpdateProfileToInactiveSqlParams,
    UpdateProfileToInactiveSqlRow,
)

client_router = APIRouter()
server_router = APIRouter()


@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection with immediate cleanup"""
    # Log activity before cleanup, so profile lookup still works
    try:
        await log_websocket_activity(
            sid=sid,
            event_key="websocket.disconnected",
            template="{{ actor.name }} disconnected from WebSocket",
            context={},
            endpoint="/socket/v4/disconnect",
            error=False,
        )
    except Exception:
        # Error logging activity - Socket.IO handles logging
        pass

    # Find and clean up profile for this socket
    # Find and clean up profile for this socket using Redis
    profile_to_cleanup = await find_profile_by_socket(sid)

    if profile_to_cleanup:
        # Remove from socket ownership using Redis
        await remove_socket_owner(profile_to_cleanup)
        # Update database to mark profile as inactive
        try:
            from datetime import UTC, datetime

            async with get_db_connection() as conn:
                async with conn.transaction():
                    params = UpdateProfileToInactiveSqlParams(
                        profile_id=uuid.UUID(profile_to_cleanup),
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

    # If this was a guest connection, update counter
    if await is_guest_socket(sid):
        try:
            await remove_guest_socket(sid)
            # Decrement guest count
            await decrement_guest_count()
        except Exception:
            # Error removing guest - Socket.IO handles logging
            pass

    # Remove from all active connections using Redis
    chat_ids = await find_chats_by_socket(sid)
    for chat_id in chat_ids:
        await remove_active_connection(chat_id, sid)


# FastAPI endpoint for OpenAPI documentation (disconnect is a lifecycle event, no request payload)
@client_router.post("/disconnect")
async def disconnect_api() -> dict[str, bool]:
    """Client-to-server lifecycle event: Close WebSocket connection."""
    return {"success": True}

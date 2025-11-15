"""Handler for connect WebSocket event."""

import logging
import time
from typing import Any
from urllib.parse import parse_qs

from app.main import sio
from app.utils.websocket_utils import (add_guest_socket,
                                       cleanup_profile_connection,
                                       get_socket_owner, increment_guest_count,
                                       set_socket_owner)

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def connect(sid: str, environ: Any, auth: Any) -> bool:
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

    # Resolve "guest-profile-id" to actual default guest profile
    if profile_id == "guest-profile-id":
        try:
            from app.db import get_pool
            from app.utils.sql_helper import load_sql

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    sql = load_sql("sql/v3/profile/get_default_guest_profile.sql")
                    guest_row = await conn.fetchrow(sql)
                    if guest_row:
                        profile_id = str(guest_row["id"])
                        logger.info(
                            f"Resolved 'guest-profile-id' to actual guest profile: {profile_id}"
                        )
                    else:
                        logger.warning(
                            "No default guest profile found; treating as anonymous guest"
                        )
                        profile_id = None
            else:
                logger.error(
                    "Database pool not available; cannot resolve guest profile"
                )
                profile_id = None
        except Exception as e:
            logger.error(f"Error resolving guest profile: {e}")
            profile_id = None

    if profile_id:
        # Check if another socket is already active for this profile
        old_sid = await get_socket_owner(profile_id)
        if old_sid and old_sid != sid:
            logger.warning(
                f"Profile {profile_id} already has active socket {old_sid}. "
                f"Closing old connection and accepting new one {sid}."
            )
            # Clean up the entire old session for this profile
            await cleanup_profile_connection(profile_id, "new socket takeover")
            # Forcefully disconnect the old socket from the server-side
            await sio.disconnect(old_sid)

        # Store socket ownership
        await set_socket_owner(profile_id, sid)
        await sio.enter_room(sid, profile_id)

        # Update database to mark profile as active
        try:
            from datetime import UTC, datetime

            from app.db import get_pool
            from app.utils.sql_helper import load_sql

            pool = get_pool()
            if pool:
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        sql = load_sql("sql/v3/profile/update_profile_to_active_complete.sql")
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

                from datetime import UTC, datetime

                from app.db import get_pool
                from app.utils.sql_helper import load_sql

                pool = get_pool()
                if pool:
                    async with pool.acquire() as conn:
                        async with conn.transaction():
                            # Find and update default guest profile
                            sql = load_sql("sql/v3/profile/update_default_guest_profile_to_active_complete.sql")
                            await conn.fetchrow(sql, datetime.now(UTC))
                        logger.info(
                            "Marked default guest profile active (guest connection added)"
                        )
            except Exception as e:
                logger.error(
                    f"Error updating default guest profile activity on connect: {e}"
                )
        else:
            logger.info("Anonymous guest connection with no guest_id; broadcasts only.")

    await sio.emit(
        "connection_confirmed",
        {
            "sid": sid,
            "profile_id": profile_id,
            "guest_id": guest_id,
            "server_time": time.time(),
        },
        room=sid,
    )

    logger.info(
        f"Client connected successfully: sid={sid}, profile_id={profile_id}, guest_id={guest_id}"
    )
    return True


"""WebSocket activity logging utility."""

import asyncio
from typing import Any

from app.main import get_pool
from app.utils.activity.audit import jinja
from app.utils.logging.db_logger import get_logger
from app.utils.websocket.find_profile_by_socket import find_profile_by_socket

logger = get_logger(__name__)


async def log_websocket_activity(
    sid: str,
    event_key: str,
    template: str,
    context: dict[str, Any],
    endpoint: str,
    error: bool = False,
) -> None:
    """Log WebSocket activity to database (async, fire-and-forget).

    Args:
        sid: Socket ID (always available in WebSocket handlers)
        event_key: Stable identifier for the event (e.g., "simulations.text.started")
        template: Jinja2 template string for the activity message
        context: Context dict with actor and other data (will be merged with actor)
        endpoint: Route path (e.g., "/socket/v3/simulations/text/start")
        error: Whether this activity represents an error
    """
    try:
        # Get profile_id from sid
        profile_id = await find_profile_by_socket(sid)
        if not profile_id:
            # Skip logging if no profile_id found
            logger.debug(
                f"No profile_id found for socket {sid}, skipping activity logging"
            )
            return

        # Get database pool
        pool = get_pool()
        if not pool:
            logger.debug("Database pool not available, skipping activity logging")
            return

        # Get actor_name from database
        async with pool.acquire() as conn:
            actor_name_row = await conn.fetchrow(
                "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
                profile_id,
            )
            actor_name = actor_name_row["actor_name"] if actor_name_row else None

            if not actor_name:
                logger.debug(
                    f"No actor_name found for profile {profile_id}, skipping activity logging"
                )
                return

            # Merge actor into context
            ctx = context.copy()
            ctx["actor"] = {"name": actor_name, "id": profile_id}

            # Render template to produce final message string
            template_error = False
            try:
                template_obj = jinja.from_string(template)
                message = template_obj.render(**ctx)
            except Exception as e:
                # Never break the handler because audit rendering failed
                template_error = True
                message = f"[audit_render_error] {event_key}: {e}"
                logger.warning(f"Template rendering error for {event_key}: {e}")

            # Determine if this activity represents an error
            # Error if error flag is True OR template rendering failed
            is_error = error or template_error

            # Insert into activity table (async, fire-and-forget)
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(
                        _insert_activity(message, endpoint, profile_id, is_error, pool)
                    )
                else:
                    asyncio.run(
                        _insert_activity(message, endpoint, profile_id, is_error, pool)
                    )
            except RuntimeError:
                # No event loop, skip DB write
                pass

    except Exception as e:
        # Never break WebSocket handler if activity logging fails
        logger.warning(
            f"Error logging WebSocket activity for {event_key}: {e}", exc_info=True
        )


async def _insert_activity(
    message: str, endpoint: str, profile_id: str, error: bool, pool: Any
) -> None:
    """Insert activity record into database.

    Args:
        message: Fully rendered activity message
        endpoint: Route path
        profile_id: Profile UUID
        error: Whether this activity represents an error
        pool: Database connection pool
    """
    if pool is None:
        return

    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO activity (message, endpoint, profile_id, error, created_at)
                VALUES ($1, $2, $3, $4, now())
                """,
                message,
                endpoint,
                profile_id,
                error,
            )
    except Exception:
        # Never break logging if DB write fails
        pass

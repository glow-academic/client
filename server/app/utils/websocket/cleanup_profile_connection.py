"""Clean up all connections for a profile."""

from app.main import get_pool
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from app.utils.websocket.remove_socket_owner import remove_socket_owner

logger = get_logger(__name__)


async def cleanup_profile_connection(profile_id: str, reason: str = "cleanup") -> None:
    """Clean up all connections for a profile."""
    logger.info(f"Cleaning up profile {profile_id} connections - {reason}")

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

"""Centralized database-backed logger utility.

Provides a logger that writes to both console and database, with automatic
module-based logger names and guest profile ID resolution (Chris Date: No Nulls).
"""

import contextvars
import json
import logging
from typing import Any, cast

import asyncpg  # type: ignore

# Context variable to store profile_id for logger access
profile_id_context: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "profile_id", default=None
)

# Global DB pool (set during startup)
_db_pool: asyncpg.Pool | None = None


def setup_db_logger(db_pool: asyncpg.Pool) -> None:
    """Initialize the database logger with a connection pool."""
    global _db_pool
    _db_pool = db_pool
    logger = logging.getLogger("app.utils.logging.db_logger")
    logger.info("Database logger initialized")


async def resolve_profile_from_department_cookies(
    department_id: str | None, auth_mode: str | None
) -> str | None:
    """Resolve profile ID from department-id + auth-mode cookies.

    Args:
        department_id: Department ID from cookie (can be None for default settings)
        auth_mode: Auth mode from cookie ("default-guest" or "default-account")

    Returns:
        Resolved profile ID UUID string, or None if not found
    """
    if not auth_mode or auth_mode not in ("default-guest", "default-account"):
        return None

    if _db_pool is None:
        return None

    try:
        async with _db_pool.acquire() as conn:
            sql = """
                WITH resolve_profile_from_department AS (
                    SELECT 
                        CASE 
                            WHEN $2::text = 'default-guest' THEN
                                COALESCE(
                                    -- Try department-specific settings first (only if department_id is provided)
                                    CASE 
                                        WHEN $1::text IS NOT NULL AND $1::text != '' THEN
                                            (SELECT sdg.profile_id
                                             FROM settings s
                                             JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                             JOIN settings_default_guest sdg ON sdg.settings_id = s.id AND sdg.active = true
                                             WHERE ds.department_id = $1::uuid AND s.active = true
                                             LIMIT 1)
                                        ELSE NULL::uuid
                                    END,
                                    -- Fallback to default settings (no department links) - always try this
                                    (SELECT sdg.profile_id
                                     FROM settings s
                                     JOIN settings_default_guest sdg ON sdg.settings_id = s.id AND sdg.active = true
                                     WHERE s.active = true
                                       AND NOT EXISTS (
                                           SELECT 1 FROM department_settings ds 
                                           WHERE ds.settings_id = s.id AND ds.active = true
                                       )
                                     LIMIT 1)
                                )
                            WHEN $2::text = 'default-account' THEN
                                COALESCE(
                                    -- Try department-specific settings first (only if department_id is provided)
                                    CASE 
                                        WHEN $1::text IS NOT NULL AND $1::text != '' THEN
                                            (SELECT sda.profile_id
                                             FROM settings s
                                             JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                                             JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
                                             WHERE ds.department_id = $1::uuid AND s.active = true
                                             LIMIT 1)
                                        ELSE NULL::uuid
                                    END,
                                    -- Fallback to default settings (no department links) - always try this
                                    (SELECT sda.profile_id
                                     FROM settings s
                                     JOIN settings_default_account sda ON sda.settings_id = s.id AND sda.active = true
                                     WHERE s.active = true
                                       AND NOT EXISTS (
                                           SELECT 1 FROM department_settings ds 
                                           WHERE ds.settings_id = s.id AND ds.active = true
                                       )
                                     LIMIT 1)
                                )
                        END as resolved_profile_id
                )
                SELECT resolved_profile_id::text FROM resolve_profile_from_department
                WHERE resolved_profile_id IS NOT NULL
            """
            result: Any = await conn.fetchval(sql, department_id, auth_mode)
            if result is None:
                return None
            # fetchval returns UUID object, convert to string
            return str(result)  # type: ignore[return-value]
    except Exception:
        # Log error but don't break request processing
        logger = logging.getLogger("app.utils.logging.db_logger")
        logger.warning(
            "Failed to resolve profile from department cookies", exc_info=True
        )
        return None


class DBLogHandler(logging.Handler):
    """Custom logging handler (database writing removed - app_logs table no longer exists).
    
    This handler is kept for compatibility but does not write to database.
    Console logging still works via logger.propagate = True.
    Activity logging uses the activity table via app.utils.activity.logger instead.
    """

    def emit(self, record: logging.LogRecord) -> None:
        """Emit a log record (no-op - database writing removed)."""
        # Database writing removed - app_logs table was replaced by activity table
        # Console logging still works via logger.propagate = True
        # Activity logging is handled by app.utils.activity.logger
        pass


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger for the given module name.

    Args:
        name: Module name (typically __name__)

    Returns:
        Configured logger instance that writes to both console and DB
    """
    logger = logging.getLogger(name)

    # Only add handler once per logger
    if not any(isinstance(h, DBLogHandler) for h in logger.handlers):
        handler = DBLogHandler()
        handler.setLevel(logging.DEBUG)
        logger.addHandler(handler)

    # Ensure logger propagates to root logger (for console output)
    logger.propagate = True

    return logger


def set_profile_id(profile_id: str | None) -> None:
    """Set the profile_id in context for logger access.

    Args:
        profile_id: Profile ID to set in context
    """
    profile_id_context.set(profile_id)

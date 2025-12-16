"""Centralized database-backed logger utility.

Provides a logger that writes to both console and database, with automatic
module-based logger names and guest profile ID resolution (Chris Date: No Nulls).
"""

import contextvars
import json
import logging
from typing import Any

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
            result = await conn.fetchval(sql, department_id, auth_mode)
            return result
    except Exception:
        # Log error but don't break request processing
        logger = logging.getLogger("app.utils.logging.db_logger")
        logger.warning(
            "Failed to resolve profile from department cookies", exc_info=True
        )
        return None


class DBLogHandler(logging.Handler):
    """Custom logging handler that writes to database asynchronously."""

    def emit(self, record: logging.LogRecord) -> None:
        """Emit a log record to the database (non-blocking)."""
        if _db_pool is None:
            return  # DB not initialized, skip

        try:
            # Get profile_id from context or record
            profile_id = profile_id_context.get(None)
            if not profile_id:
                # Try to get from record if set
                profile_id = getattr(record, "profile_id", None)

            # If no profile_id, skip DB write (use standard logger only)
            if not profile_id:
                return

            # Schedule async write (fire and forget)
            import asyncio

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If loop is running, schedule as task
                    asyncio.create_task(self._write_to_db(record, profile_id))
                else:
                    # If no loop running, create new one
                    asyncio.run(self._write_to_db(record, profile_id))
            except RuntimeError:
                # No event loop, skip DB write (fallback to console only)
                pass
        except Exception:
            # Never break logging if DB write fails
            pass

    async def _write_to_db(
        self, record: logging.LogRecord, profile_id: str | None
    ) -> None:
        """Write log record to database."""
        if _db_pool is None:
            return

        try:
            # Prepare extra data
            extra_data: dict[str, Any] = {}
            if hasattr(record, "extra_data"):
                extra_data = record.extra_data
            elif record.exc_info:
                import traceback

                extra_data["exception"] = traceback.format_exception(*record.exc_info)

            # Write to database
            # Inserts into both app_logs and app_logs_profiles junction table
            async with _db_pool.acquire() as conn:
                await conn.execute(
                    """
                    WITH insert_log AS (
                        INSERT INTO app_logs (level, logger_name, message, extra, ts)
                        SELECT 
                            $1::text,
                            $2::text,
                            $3::text,
                            $5::jsonb,
                            now()
                        RETURNING id
                    )
                    INSERT INTO app_logs_profiles (app_log_id, profile_id, created_at, updated_at)
                    SELECT 
                        il.id,
                        $4::uuid,
                        now(),
                        now()
                    FROM insert_log il
                    WHERE $4::uuid IS NOT NULL
                    """,
                    record.levelname.lower(),
                    record.name,
                    record.getMessage(),
                    profile_id,
                    json.dumps(extra_data) if extra_data else None,
                )
        except Exception:
            # Never break logging if DB write fails
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

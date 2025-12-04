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


async def resolve_profile_id(profile_id: str | None) -> str:
    """Resolve 'guest-profile-id' to actual guest UUID using cached value (Chris Date: No Nulls).
    
    Args:
        profile_id: Profile ID string, may be "guest-profile-id" or None
        
    Returns:
        Resolved UUID string (never null)
    """
    if not profile_id or profile_id == "guest-profile-id":
        # Use cached guest profile UUID (no DB call needed)
        try:
            from app.main import get_guest_profile_id
            
            return get_guest_profile_id()
        except RuntimeError:
            # Fallback: return a placeholder if not initialized
            # This should not happen in normal operation
            logger = logging.getLogger("app.utils.logging.db_logger")
            logger.warning("Guest profile UUID not initialized; using placeholder")
            return "00000000-0000-0000-0000-000000000000"
    
    return profile_id


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
            
            # If no profile_id, resolve to guest
            if not profile_id:
                profile_id = "guest-profile-id"
            
            # Schedule async write (fire and forget)
            import asyncio
            
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # If loop is running, schedule as task
                    asyncio.create_task(
                        self._write_to_db(record, profile_id)
                    )
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
            
            # Write to database (SQL will resolve guest-profile-id)
            # Inserts into both app_logs and app_logs_profiles junction table
            async with _db_pool.acquire() as conn:
                await conn.execute(
                    """
                    WITH resolve_guest_profile AS (
                        SELECT 
                            sdg.profile_id as guest_profile_id
                        FROM settings_default_guest sdg
                        JOIN settings s ON s.id = sdg.settings_id AND s.active = true
                        WHERE sdg.active = true
                        LIMIT 1
                    ),
                    resolve_profile_id AS (
                        SELECT 
                            CASE 
                                WHEN $4::text = 'guest-profile-id' THEN
                                    (SELECT guest_profile_id FROM resolve_guest_profile)
                                ELSE $4::uuid
                            END as resolved_profile_id
                    ),
                    insert_log AS (
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
                        rpi.resolved_profile_id,
                        now(),
                        now()
                    FROM insert_log il
                    CROSS JOIN resolve_profile_id rpi
                    WHERE rpi.resolved_profile_id IS NOT NULL
                    """,
                    record.levelname.lower(),
                    record.name,
                    record.getMessage(),
                    profile_id or "guest-profile-id",
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


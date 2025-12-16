"""Activity logger utility for rendering templates and inserting activity records."""

import asyncio
from typing import Any

import asyncpg  # type: ignore
from app.utils.activity.audit import AuditIntent, jinja
from fastapi import Request

# Global DB pool (set during startup)
_db_pool: asyncpg.Pool | None = None


def setup_activity_logger(db_pool: asyncpg.Pool) -> None:
    """Initialize the activity logger with a connection pool.

    Args:
        db_pool: Database connection pool
    """
    global _db_pool
    _db_pool = db_pool


async def log_activity(
    request: Request,
    response_status_code: int,
    duration_ms: float,
    resolved_profile_id: str,
) -> None:
    """Log activity to database (async, fire-and-forget).

    Args:
        request: FastAPI request object
        response_status_code: HTTP response status code
        duration_ms: Request duration in milliseconds
        resolved_profile_id: Resolved profile UUID
    """
    if _db_pool is None:
        return  # DB not initialized, skip

    intent: AuditIntent | None = getattr(request.state, "audit_intent", None)
    if not intent:
        return  # No audit intent, skip

    ctx: dict[str, Any] = getattr(request.state, "audit_ctx", {}) or {}

    # Add universal meta fields
    ctx.setdefault("meta", {})
    ctx["meta"].update(
        {
            "method": request.method,
            "path": str(request.url.path),
            "status": response_status_code,
            "latency_ms": round(duration_ms, 2),
        }
    )

    # Render template to produce final message string
    try:
        template = jinja.from_string(intent.template)
        message = template.render(**ctx)
    except Exception as e:
        # Never break the request because audit rendering failed
        message = f"[audit_render_error] {intent.event_key}: {e}"

    # Insert into activity table (async, fire-and-forget)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(
                _insert_activity(message, str(request.url.path), resolved_profile_id)
            )
        else:
            asyncio.run(
                _insert_activity(message, str(request.url.path), resolved_profile_id)
            )
    except RuntimeError:
        # No event loop, skip DB write
        pass


async def _insert_activity(
    message: str, endpoint: str, profile_id: str
) -> None:
    """Insert activity record into database.

    Args:
        message: Fully rendered activity message
        endpoint: Route path
        profile_id: Profile UUID
    """
    if _db_pool is None:
        return

    try:
        async with _db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO activity (message, endpoint, profile_id, created_at)
                VALUES ($1, $2, $3, now())
                """,
                message,
                endpoint,
                profile_id,
            )
    except Exception:
        # Never break logging if DB write fails
        pass


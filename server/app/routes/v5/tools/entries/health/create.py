"""Health CREATE — insert entry."""

from datetime import UTC, datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.health.types import CreateHealthResponse


async def create_health(
    conn: asyncpg.Connection,
    service: str,
    ok: bool,
    latency_ms: float,
    ts: datetime | None = None,
    error: str = "",
    session_id: UUID | None = None,
    mcp: bool = False,
    soft: bool = False,
) -> CreateHealthResponse:
    """Create a health entry."""
    if ts is None:
        ts = datetime.now(UTC)

    health_id = await conn.fetchval(
        """INSERT INTO health_entry (ts, service, ok, latency_ms, error, session_id, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id""",
        ts,
        service,
        ok,
        latency_ms,
        error,
        session_id,
        not soft,
        mcp,
    )

    if health_id is None:
        raise ValueError("Failed to create health entry")

    return CreateHealthResponse(id=health_id)

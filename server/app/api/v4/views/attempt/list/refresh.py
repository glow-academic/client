"""Refresh endpoint for attempt list view.

REFRESH MATERIALIZED VIEW CONCURRENTLY - fast, no schema change, requires unique index.
"""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.views.types import RefreshResponse
from app.infra.v4.activity.audit import audit_activity
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

router = APIRouter()


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    dependencies=[
        audit_activity(
            "views.attempt.list.refresh",
            "{{ actor.name }} refreshed attempt list view",
        )
    ],
)
async def refresh_attempts_view(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Refresh the attempt_mv materialized view concurrently.

    This is a fast refresh that doesn't require any schema changes.
    It requires a unique index on the MV (attempt_mv_pk).

    Use this when:
    - You want to update the MV data without downtime
    - The MV schema hasn't changed

    Use /recreate when:
    - You've changed the MV definition (schema changes)
    """
    tags = ["views", "attempt", "list"]

    try:
        start_time = time.time()

        # Refresh concurrently (requires unique index)
        await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY attempt_mv")

        duration_ms = int((time.time() - start_time) * 1000)

        # Invalidate cache
        await invalidate_tags(tags)

        return RefreshResponse(
            success=True,
            method="concurrent",
            message=f"Refreshed attempt_mv in {duration_ms}ms",
            duration_ms=duration_ms,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh attempt_mv: {str(e)}",
        ) from e

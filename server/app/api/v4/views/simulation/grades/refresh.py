"""Refresh endpoint for simulation grades view."""

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
            "views.simulation.grades.refresh",
            "{{ actor.name }} refreshed simulation grades view",
        )
    ],
)
async def refresh_grades_view(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Refresh the mv_attempt_grade materialized view concurrently."""
    tags = ["views", "simulation", "grades"]
    try:
        start_time = time.time()
        await conn.execute(
            "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attempt_grade"
        )
        duration_ms = int((time.time() - start_time) * 1000)
        await invalidate_tags(tags)
        return RefreshResponse(
            success=True,
            method="concurrent",
            message=f"Refreshed mv_attempt_grade in {duration_ms}ms",
            duration_ms=duration_ms,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to refresh mv_attempt_grade: {str(e)}"
        ) from e

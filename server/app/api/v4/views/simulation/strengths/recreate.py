"""Recreate endpoint for simulation strengths view."""

import time
from pathlib import Path
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.views.types import RefreshResponse
from app.infra.v4.activity.audit import audit_activity
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

MV_SQL_PATH = (
    Path(__file__).parent.parent.parent.parent.parent
    / "sql/v4/views/simulation/mv_attempt_strength.sql"
)

router = APIRouter()


@router.post(
    "/recreate",
    response_model=RefreshResponse,
    dependencies=[
        audit_activity(
            "views.simulation.strengths.recreate",
            "{{ actor.name }} recreated simulation strengths view",
        )
    ],
)
async def recreate_strengths_view(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Recreate the mv_attempt_strength materialized view."""
    tags = ["views", "simulation", "strengths"]
    try:
        if not MV_SQL_PATH.exists():
            raise HTTPException(
                status_code=500, detail=f"MV definition file not found: {MV_SQL_PATH}"
            )
        mv_definition = MV_SQL_PATH.read_text()
        start_time = time.time()
        await conn.execute(mv_definition)
        duration_ms = int((time.time() - start_time) * 1000)
        await invalidate_tags(tags)
        return RefreshResponse(
            success=True,
            method="recreate",
            message=f"Recreated mv_attempt_strength in {duration_ms}ms",
            duration_ms=duration_ms,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to recreate mv_attempt_strength: {str(e)}",
        ) from e

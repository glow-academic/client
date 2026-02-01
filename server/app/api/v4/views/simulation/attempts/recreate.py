"""Recreate endpoint for simulation attempts view.

DROP + CREATE - for schema changes, brief downtime.
"""

import time
from pathlib import Path
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.views.types import RefreshResponse
from app.infra.v4.activity.audit import audit_activity
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

# Path to MV definition SQL file
MV_SQL_PATH = Path(__file__).parent.parent.parent.parent.parent / "sql/v4/views/simulation/simulation_attempts_view.sql"

router = APIRouter()


@router.post(
    "/recreate",
    response_model=RefreshResponse,
    dependencies=[
        audit_activity(
            "views.simulation.attempts.recreate",
            "{{ actor.name }} recreated simulation attempts view",
        )
    ],
)
async def recreate_attempts_view(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Recreate the mv_simulation_attempts materialized view.

    This drops and recreates the MV from its definition file.
    There will be brief downtime while the MV is being recreated.

    Use this when:
    - You've changed the MV definition (schema changes)
    - You need to rebuild from scratch

    Use /refresh when:
    - You just want to update the data
    - The MV schema hasn't changed
    """
    tags = ["views", "simulation", "attempts"]

    try:
        # Read MV definition from SQL file
        if not MV_SQL_PATH.exists():
            raise HTTPException(
                status_code=500,
                detail=f"MV definition file not found: {MV_SQL_PATH}",
            )

        mv_definition = MV_SQL_PATH.read_text()

        start_time = time.time()

        # Execute the full MV definition (includes DROP + CREATE + indexes + REFRESH)
        await conn.execute(mv_definition)

        duration_ms = int((time.time() - start_time) * 1000)

        # Invalidate cache
        await invalidate_tags(tags)

        return RefreshResponse(
            success=True,
            method="recreate",
            message=f"Recreated mv_simulation_attempts in {duration_ms}ms",
            duration_ms=duration_ms,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to recreate mv_simulation_attempts: {str(e)}",
        ) from e

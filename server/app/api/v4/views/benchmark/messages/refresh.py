"""Refresh mv_benchmark_messages materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


@router.post(
    "/refresh",
    response_model=dict[str, bool],
    dependencies=[
        audit_activity(
            "views.benchmark.messages.refresh",
            "{{ actor.name }} refreshed benchmark messages view",
        )
    ],
)
async def refresh_benchmark_messages(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict[str, bool]:
    """Refresh mv_benchmark_messages concurrently."""
    try:
        await conn.execute(
            "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_benchmark_messages"
        )
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_benchmark_messages_refresh",
            request=http_request,
        )
        return {"success": False}

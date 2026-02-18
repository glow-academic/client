"""Refresh test_invocation_mv materialized view."""

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
            "views.benchmark.invocations.refresh",
            "{{ actor.name }} refreshed benchmark invocations view",
        )
    ],
)
async def refresh_test_invocation(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict[str, bool]:
    """Refresh test_invocation_mv concurrently."""
    try:
        await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY test_invocation_mv")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_test_invocation_refresh",
            request=http_request,
        )
        return {"success": False}


# Backward-compatible alias
refresh_benchmark_chats = refresh_test_invocation

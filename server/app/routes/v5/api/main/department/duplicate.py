"""Department duplicate endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.department_duplicate.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.department_duplicate import duplicate_department_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.department.types import (
    DuplicateDepartmentApiRequest,
    DuplicateDepartmentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateDepartmentApiResponse,
)
async def duplicate_department(
    request: DuplicateDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateDepartmentApiResponse:
    """Duplicate a department — composable infra architecture."""
    tags = ["departments"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await duplicate_department_client(
            conn,
            redis,
            profile_id=profile_id,
            department_id=request.department_id,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_department",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

"""Parameter delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.parameter_delete.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.parameter_delete import delete_parameter_client
from app.routes.v5.api.main.parameter.types import (
    DeleteParameterApiRequest,
    DeleteParameterApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeleteParameterApiResponse)
async def delete_parameter(
    request: DeleteParameterApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteParameterApiResponse:
    """Bulk delete parameters — composable infra architecture."""
    tags = ["parameters"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await delete_parameter_client(
            conn,
            redis,
            profile_id=profile_id,
            parameter_ids=request.parameter_ids,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_parameter",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

"""Model duplicate endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.model_duplicate.
"""

from __future__ import annotations

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.infra.model_duplicate import duplicate_model_client
from app.routes.v5.api.main.model.types import (
    DuplicateModelApiRequest,
    DuplicateModelApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateModelApiResponse,
)
async def duplicate_model(
    request: DuplicateModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateModelApiResponse:
    """Duplicate a model — composable infra architecture."""
    tags = ["models"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await duplicate_model_client(
            conn,
            redis,
            profile_id=profile_id,
            model_id=request.model_id,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_model",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

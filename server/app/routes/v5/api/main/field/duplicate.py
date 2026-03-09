"""Field duplicate endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.field_duplicate.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.field_duplicate import duplicate_field_client
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.field.types import (
    DuplicateFieldApiRequest,
    DuplicateFieldApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateFieldApiResponse,
)
async def duplicate_field(
    request: DuplicateFieldApiRequest,
    http_request: Request,
    response: Response,
) -> DuplicateFieldApiResponse:
    """Duplicate a field — composable infra architecture."""
    tags = ["fields"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()
        result = await duplicate_field_client(
            pool,
            redis,
            profile_id=profile_id,
            field_id=request.field_id,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_field",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

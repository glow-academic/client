"""Field delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.field_delete.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.field_delete import delete_field_client
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.field.types import (
    DeleteFieldApiRequest,
    DeleteFieldApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeleteFieldApiResponse)
async def delete_field(
    request: DeleteFieldApiRequest,
    http_request: Request,
    response: Response,
) -> DeleteFieldApiResponse:
    """Bulk delete fields — composable infra architecture."""
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
        result = await delete_field_client(
            pool,
            redis,
            profile_id=profile_id,
            field_ids=request.field_ids,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_field",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

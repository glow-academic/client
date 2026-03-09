"""Model delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.model_delete.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.globals import get_pool, get_redis_client
from app.infra.model_delete import delete_model_client
from app.routes.v5.api.main.model.types import (
    DeleteModelApiRequest,
    DeleteModelApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeleteModelApiResponse)
async def delete_model(
    request: DeleteModelApiRequest,
    http_request: Request,
    response: Response,
) -> DeleteModelApiResponse:
    """Bulk delete models — composable infra architecture."""
    tags = ["models"]

    try:
        profile_id = http_request.state.profile_id
        session_id = http_request.state.session_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()
        result = await delete_model_client(
            pool,
            redis,
            profile_id=profile_id,
            model_ids=request.model_ids,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_model",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

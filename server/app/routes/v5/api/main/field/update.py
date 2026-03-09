"""Field update endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.field_update.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.field_update import update_field_client
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.field.types import (
    UpdateFieldApiRequest,
    UpdateFieldApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/update", response_model=UpdateFieldApiResponse)
async def update_field(
    request: UpdateFieldApiRequest,
    http_request: Request,
    response: Response,
) -> UpdateFieldApiResponse:
    """Update fields using composable infra architecture."""
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()

        response_data = await update_field_client(
            pool,
            redis,
            profile_id=profile_id,
            items=request.fields,
            group_id=request.group_id,
        )

        response.headers["X-Invalidate-Tags"] = "fields"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_field",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

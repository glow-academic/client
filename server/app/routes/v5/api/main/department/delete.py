"""Department delete endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.department.delete.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.department.delete import delete_department_impl
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.department.types import (
    DeleteDepartmentApiRequest,
    DeleteDepartmentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/delete", response_model=DeleteDepartmentApiResponse)
async def delete_department(
    request: DeleteDepartmentApiRequest,
    http_request: Request,
    response: Response,
) -> DeleteDepartmentApiResponse:
    """Bulk delete departments — composable infra architecture."""
    tags = ["departments"]

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
        result = await delete_department_impl(
            pool,
            redis,
            profile_id=profile_id,
            department_ids=request.department_ids,
            session_id=session_id,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_department",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

"""Department GET endpoint — thin HTTP adapter over the canonical shared operation."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.department.get import get_department_impl
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.department.types import (
    GetDepartmentApiRequest,
    GetDepartmentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=GetDepartmentApiResponse)
async def get_department(
    request: GetDepartmentApiRequest,
    http_request: Request,
    response: Response,
) -> GetDepartmentApiResponse:
    """Get department information using the canonical shared department operation."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        session_id = http_request.state.session_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_department_impl(
            get_pool(),
            get_redis_client(),
            profile_id=profile_id,
            session_id=session_id,
            department_id=request.department_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "departments"
        response.headers["X-Cache-Hit"] = "0"
        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_department",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

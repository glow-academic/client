"""Department search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.department.search.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.department.search import search_department_impl
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.department.types import ListDepartmentApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchDepartmentApiRequest(BaseModel):
    """Request model for department search endpoint."""

    # Main filters
    search: str | None = None
    # Pagination
    page_size: int | None = 12
    page_offset: int | None = 0


@router.post("/search", response_model=ListDepartmentApiResponse)
async def search_department(
    request: SearchDepartmentApiRequest,
    http_request: Request,
    response: Response,
) -> ListDepartmentApiResponse:
    """Search departments — composable infra architecture."""
    tags = ["departments"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()
        result = await search_department_impl(
            pool,
            redis,
            profile_id=profile_id,
            search=request.search,
            page_size=request.page_size or 12,
            page_offset=request.page_offset or 0,
        )

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_department",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

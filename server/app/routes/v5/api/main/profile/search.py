"""Profile search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.profile.search.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_pool, get_redis_client
from app.infra.profile.search import search_profile_impl
from app.routes.v5.api.main.profile.types import ListProfilesApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchProfileApiRequest(BaseModel):
    """Request model for profile search endpoint."""

    # Main filters
    search: str | None = None
    cohort_ids: list[UUID] | None = None
    filter_department_ids: list[UUID] | None = None
    role_filter: str | None = None
    # Facet search text
    cohort_search: str | None = None
    department_search: str | None = None
    role_search: str | None = None
    # Pagination
    page_size: int | None = 12
    page_offset: int | None = 0


@router.post("/search", response_model=ListProfilesApiResponse)
async def search_profile(
    request: SearchProfileApiRequest,
    http_request: Request,
    response: Response,
) -> ListProfilesApiResponse:
    """Search profiles — composable infra architecture."""
    tags = ["profiles"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()
        result = await search_profile_impl(
            pool,
            redis,
            profile_id=profile_id,
            search=request.search,
            cohort_ids=request.cohort_ids,
            filter_department_ids=request.filter_department_ids,
            role_filter=request.role_filter,
            cohort_search=request.cohort_search,
            department_search=request.department_search,
            role_search=request.role_search,
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
            operation="search_profile",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

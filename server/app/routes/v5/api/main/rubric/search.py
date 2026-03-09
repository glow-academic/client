"""Rubric search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.rubric_search.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_pool, get_redis_client
from app.infra.rubric_search import search_rubric_client
from app.routes.v5.api.main.rubric.types import ListRubricApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchRubricApiRequest(BaseModel):
    """Request model for rubric search endpoint."""

    # Main filters
    search: str | None = None
    filter_department_ids: list[UUID] | None = None
    filter_simulation_ids: list[UUID] | None = None
    # Facet search text
    department_search: str | None = None
    simulation_search: str | None = None
    # Pagination
    page_size: int | None = 12
    page_offset: int | None = 0


@router.post("/search", response_model=ListRubricApiResponse)
async def search_rubric(
    request: SearchRubricApiRequest,
    http_request: Request,
    response: Response,
) -> ListRubricApiResponse:
    """Search rubrics — composable infra architecture."""
    tags = ["rubrics"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()
        result = await search_rubric_client(
            pool,
            redis,
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            filter_simulation_ids=request.filter_simulation_ids,
            department_search=request.department_search,
            simulation_search=request.simulation_search,
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
            operation="search_rubric",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

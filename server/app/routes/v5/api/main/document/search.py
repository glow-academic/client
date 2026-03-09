"""Document search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.document_search.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.document_search import search_document_client
from app.infra.globals import get_pool, get_redis_client
from app.routes.v5.api.main.document.types import ListDocumentApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchDocumentApiRequest(BaseModel):
    """Request model for document search endpoint."""

    # Main filters
    search: str | None = None
    scenario_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    filter_department_ids: list[UUID] | None = None
    # Facet search text
    scenario_search: str | None = None
    field_search: str | None = None
    department_search: str | None = None
    # Pagination
    page_size: int | None = 12
    page_offset: int | None = 0


@router.post("/search", response_model=ListDocumentApiResponse)
async def search_document(
    request: SearchDocumentApiRequest,
    http_request: Request,
    response: Response,
) -> ListDocumentApiResponse:
    """Search documents — composable infra architecture."""
    tags = ["documents"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()
        result = await search_document_client(
            pool,
            redis,
            profile_id=profile_id,
            search=request.search,
            scenario_ids=request.scenario_ids,
            field_ids=request.field_ids,
            filter_department_ids=request.filter_department_ids,
            scenario_search=request.scenario_search,
            field_search=request.field_search,
            department_search=request.department_search,
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
            operation="search_document",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

"""Model search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.model_search.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import get_db, get_redis_client
from app.infra.model_search import search_model_client
from app.routes.v5.api.main.model.types import ListModelApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchModelApiRequest(BaseModel):
    """Request model for model search endpoint."""

    # Main filters
    search: str | None = None
    filter_provider_ids: list[UUID] | None = None
    filter_department_ids: list[UUID] | None = None
    filter_agent_ids: list[UUID] | None = None
    # Facet search text
    provider_search: str | None = None
    department_search: str | None = None
    agent_search: str | None = None
    # Pagination
    page_size: int | None = 12
    page_offset: int | None = 0


@router.post("/list", response_model=ListModelApiResponse)
@router.post("/search", response_model=ListModelApiResponse)
async def search_model(
    request: SearchModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListModelApiResponse:
    """Search models — composable infra architecture."""
    tags = ["models"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await search_model_client(
            conn,
            redis,
            profile_id=profile_id,
            search=request.search,
            filter_provider_ids=request.filter_provider_ids,
            filter_department_ids=request.filter_department_ids,
            filter_agent_ids=request.filter_agent_ids,
            provider_search=request.provider_search,
            department_search=request.department_search,
            agent_search=request.agent_search,
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
            operation="search_model",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

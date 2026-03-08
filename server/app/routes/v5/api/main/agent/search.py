"""Agent search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.agent_search.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.agent_search import search_agent_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.agent.types import ListAgentApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchAgentApiRequest(BaseModel):
    """Request model for agent search endpoint."""

    # Main filters
    search: str | None = None
    filter_department_ids: list[UUID] | None = None
    filter_model_ids: list[UUID] | None = None
    filter_tool_ids: list[UUID] | None = None
    # Facet search text
    department_search: str | None = None
    model_search: str | None = None
    tool_search: str | None = None
    # Pagination
    page_size: int | None = 12
    page_offset: int | None = 0


@router.post("/list", response_model=ListAgentApiResponse)
@router.post("/search", response_model=ListAgentApiResponse)
async def search_agent(
    request: SearchAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListAgentApiResponse:
    """Search agents — composable infra architecture."""
    tags = ["agents"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await search_agent_client(
            conn,
            redis,
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            filter_model_ids=request.filter_model_ids,
            filter_tool_ids=request.filter_tool_ids,
            department_search=request.department_search,
            model_search=request.model_search,
            tool_search=request.tool_search,
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
            operation="search_agent",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

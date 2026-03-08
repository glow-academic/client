"""Eval search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.eval_search.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.eval_search import search_eval_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.eval.types import ListEvalApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchEvalApiRequest(BaseModel):
    """Request model for eval search endpoint."""

    # Main filters
    search: str | None = None
    filter_department_ids: list[UUID] | None = None
    # Facet search text
    department_search: str | None = None
    # Pagination
    page_size: int | None = 50
    page_offset: int | None = 0


@router.post("/list", response_model=ListEvalApiResponse)
@router.post("/search", response_model=ListEvalApiResponse)
async def search_eval(
    request: SearchEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListEvalApiResponse:
    """Search evals — composable infra architecture."""
    tags = ["evals"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await search_eval_client(
            conn,
            redis,
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            department_search=request.department_search,
            page_size=request.page_size or 50,
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
            operation="search_eval",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

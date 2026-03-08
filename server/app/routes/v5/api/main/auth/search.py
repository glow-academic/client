"""Auth search endpoint — composable infra architecture.

Thin route handler. Core logic lives in app.infra.auth_search.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.auth_search import search_auth_client
from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.auth.types import ListAuthApiResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


class SearchAuthApiRequest(BaseModel):
    """Request model for auth search endpoint."""

    # Main filters
    search: str | None = None
    filter_department_ids: list[UUID] | None = None
    # Facet search text
    department_search: str | None = None
    # Pagination
    page_size: int | None = 1000
    page_offset: int | None = 0


@router.post("/list", response_model=ListAuthApiResponse)
@router.post("/search", response_model=ListAuthApiResponse)
async def search_auth(
    request: SearchAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListAuthApiResponse:
    """Search auths — composable infra architecture."""
    tags = ["auth"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()
        result = await search_auth_client(
            conn,
            redis,
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            department_search=request.department_search,
            page_size=request.page_size or 1000,
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
            operation="search_auth",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

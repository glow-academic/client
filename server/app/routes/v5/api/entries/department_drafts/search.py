"""Department Drafts entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.department_drafts.search import search_department_drafts
from app.sql.types import (
    SearchDepartmentDraftsEntriesApiRequest,
    SearchDepartmentDraftsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/department_drafts/search",
    response_model=SearchDepartmentDraftsEntriesApiResponse,
)
async def search_department_drafts_entries(
    request: SearchDepartmentDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchDepartmentDraftsEntriesApiResponse:
    """Search department_drafts entries."""
    tags = ["entries", "department_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_department_drafts(
            conn,
            limit=request.limit_count,
            offset=request.offset_count,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchDepartmentDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_department_drafts_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

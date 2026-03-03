"""Standard groups SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.standard_groups.search import (
    SQL_PATH,
    search_standard_groups_internal,
)
from app.sql.types import (
    SearchStandardGroupsApiRequest,
    SearchStandardGroupsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

@router.post(
    "/standard_groups/search",
    response_model=SearchStandardGroupsApiResponse,
)
async def search_standard_groups(
    request: SearchStandardGroupsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchStandardGroupsApiResponse:
    """Search standard_groups resources."""
    tags = ["resources", "standard_groups"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_standard_groups_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache,
            rubric=request.rubric or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchStandardGroupsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_standard_groups",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

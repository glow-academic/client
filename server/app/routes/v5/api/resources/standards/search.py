"""Standards SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.standards.search import (
    SQL_PATH,
    search_standards_internal,
)
from app.sql.types import (
    SearchStandardsApiRequest,
    SearchStandardsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()


@router.post(
    "/standards/search",
    response_model=SearchStandardsApiResponse,
)
async def search_standards(
    request: SearchStandardsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchStandardsApiResponse:
    """Search standards resources."""
    tags = ["resources", "standards"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_standards_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            standard_group_ids=request.standard_group_ids,
            bypass_cache=bypass_cache,
            rubric=request.rubric or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchStandardsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_standards",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

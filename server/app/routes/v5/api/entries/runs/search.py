"""Runs entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.runs.search import (
    SEARCH_SQL_PATH,
    search_runs_entries_internal,
)
from app.sql.types import (
    SearchRunsEntriesApiRequest,
    SearchRunsEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# ---------------------------------------------------------------------------
# Types (merged from types.py)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Search (original search.py)
# ---------------------------------------------------------------------------


@router.post(
    "/runs/search",
    response_model=SearchRunsEntriesApiResponse,
)
async def search_runs_entries(
    request: SearchRunsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchRunsEntriesApiResponse:
    """Search runs entries."""
    tags = ["entries", "runs"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_runs_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchRunsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_runs_entries",
            sql_query=load_sql_query(SEARCH_SQL_PATH),
            sql_params=None,
            request=http_request,
        )


# ---------------------------------------------------------------------------
# List (merged from list.py)
# ---------------------------------------------------------------------------

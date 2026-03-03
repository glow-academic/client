"""Problem Statements SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.problem_statements.search import (
    SQL_PATH,
    search_problem_statements_internal,
)
from app.sql.types import (
    SearchProblemStatementsApiRequest,
    SearchProblemStatementsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/problem_statements/search",
    response_model=SearchProblemStatementsApiResponse,
)
async def search_problem_statements(
    request: SearchProblemStatementsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchProblemStatementsApiResponse:
    tags = ["resources", "problem_statements"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_problem_statements_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchProblemStatementsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_problem_statements",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

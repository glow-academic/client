"""Problem Statements GET endpoint - v4 API.

Provides get endpoint for fetching a single problem statement by ID.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.problem_statements.types import (
    GetProblemStatementApiRequest,
    GetProblemStatementApiResponse,
)
from app.routes.v5.tools.resources.problem_statements.get import (
    SQL_PATH,
    get_problem_statement_internal,
)
from app.sql.types import (
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/problem_statements/get",
    response_model=GetProblemStatementApiResponse,
)
async def get_problem_statement(
    request: GetProblemStatementApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProblemStatementApiResponse:
    """Get problem statement by ID."""
    tags = ["resources", "problem_statements"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_problem_statement_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProblemStatementApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_problem_statement",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

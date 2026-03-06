"""Problem Statements GET endpoint - v4 API.

Provides get endpoint for fetching a single problem statement by ID.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.resources.problem_statements.types import (
    GetProblemStatementApiRequest,
    GetProblemStatementApiResponse,
)
from app.routes.v5.tools.resources.problem_statements.get import (
    get_problem_statements as get_problem_statements_resource,
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
        items = await get_problem_statements_resource(
            conn, [request.id], get_redis_client(), bypass_cache
        )
        item = items[0] if items else None
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
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

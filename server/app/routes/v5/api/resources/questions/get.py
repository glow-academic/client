"""Questions GET endpoint - v4 API.

Provides get endpoint for fetching a single question by ID.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.questions.types import (
    GetQuestionApiRequest,
    GetQuestionApiResponse,
)
from app.routes.v5.tools.resources.questions.get import SQL_PATH, get_question_internal
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
    "/questions/get",
    response_model=GetQuestionApiResponse,
)
async def get_question(
    request: GetQuestionApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetQuestionApiResponse:
    """Get question by ID."""
    tags = ["resources", "questions"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        item = await get_question_internal(conn, request.id, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetQuestionApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_question",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

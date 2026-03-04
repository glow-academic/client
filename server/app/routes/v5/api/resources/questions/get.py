"""Questions GET endpoint - v4 API.

Provides get endpoint for fetching a single question by ID.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.resources.questions.types import (
    GetQuestionApiRequest,
    GetQuestionApiResponse,
)
from app.routes.v5.tools.resources.questions.get import (
    get_questions as get_questions_resource,
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
        items = await get_questions_resource(
            conn=conn,
            ids=[request.id],
            redis=get_redis_client(),
            bypass_cache=bypass_cache,
        )
        item = items[0] if items else None
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
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

"""Model rubrics SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.model_rubrics.search import (
    search_model_rubrics as search_model_rubrics_fn,
)
from app.sql.types import (
    SearchModelRubricsApiRequest,
    SearchModelRubricsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/model_rubrics/search",
    response_model=SearchModelRubricsApiResponse,
)
async def search_model_rubrics(
    request: SearchModelRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelRubricsApiResponse:
    """Search available model rubrics for models."""
    tags = ["resources", "model_rubrics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_model_rubrics_fn(
            conn,
            get_redis_client(),
            model_ids=request.model_ids,
            rubric_ids=request.rubric_ids,
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchModelRubricsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_model_rubrics",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

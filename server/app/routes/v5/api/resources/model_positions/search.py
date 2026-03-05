"""Model Positions SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.model_positions.search import (
    search_model_positions as search_model_positions_fn,
)
from app.sql.types import (
    SearchModelPositionsApiRequest,
    SearchModelPositionsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/model_positions/search",
    response_model=SearchModelPositionsApiResponse,
)
async def search_model_positions(
    request: SearchModelPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelPositionsApiResponse:
    """Search model_positions resources."""
    tags = ["resources", "model_positions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_model_positions_fn(
            conn,
            get_redis_client(),
            model_ids=request.model_ids,
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchModelPositionsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_model_positions",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

"""ConditionalParameters SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.conditional_parameters.search import (
    search_conditional_parameters as search_conditional_parameters_fn,
)
from app.sql.types import (
    SearchConditionalParametersApiRequest,
    SearchConditionalParametersApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/conditional_parameters/search",
    response_model=SearchConditionalParametersApiResponse,
)
async def search_conditional_parameters(
    request: SearchConditionalParametersApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchConditionalParametersApiResponse:
    """Search conditional_parameters resources."""
    tags = ["resources", "conditional_parameters"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_conditional_parameters_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            field=request.field or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchConditionalParametersApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_conditional_parameters",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

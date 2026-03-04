"""ConditionalParameters GET endpoint - v4 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.conditional_parameters.get import (
    get_conditional_parameters as get_conditional_parameters_resource,
)
from app.sql.types import (
    GetConditionalParametersApiRequest,
    GetConditionalParametersApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/conditional_parameters/get",
    response_model=GetConditionalParametersApiResponse,
)
async def get_conditional_parameters(
    request: GetConditionalParametersApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetConditionalParametersApiResponse:
    """Get conditional_parameters resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "conditional_parameters"]

    sql_params: tuple[Any, ...] | None = None

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await get_conditional_parameters_resource(
            conn=conn,
            ids=request.ids or [],
            redis=get_redis_client(),
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetConditionalParametersApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_conditional_parameters",
            sql_query=None,
            sql_params=sql_params,
            request=http_request,
        )

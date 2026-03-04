"""ConditionalParameters GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.conditional_parameters.get import (
    SQL_PATH,
    get_conditional_parameters_internal,
)
from app.sql.types import (
    GetConditionalParametersApiRequest,
    GetConditionalParametersApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
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
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_conditional_parameters_internal(
            conn, request.ids, bypass_cache
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
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

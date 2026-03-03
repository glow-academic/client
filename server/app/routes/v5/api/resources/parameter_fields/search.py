"""Parameter Fields SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.parameter_fields.search import (
    SQL_PATH,
    search_parameter_fields_internal,
)
from app.sql.types import (
    SearchParameterFieldsApiRequest,
    SearchParameterFieldsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

@router.post(
    "/parameter_fields/search",
    response_model=SearchParameterFieldsApiResponse,
)
async def search_parameter_fields(
    request: SearchParameterFieldsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchParameterFieldsApiResponse:
    """Search parameter fields resources by parameter IDs.

    Returns all available parameter_fields for the given parameters.
    """
    tags = ["resources", "parameter_fields"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_parameter_fields_internal(
            conn,
            request.parameter_ids or [],
            bypass_cache=bypass_cache,
            document=request.document or False,
            persona=request.persona or False,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchParameterFieldsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_parameter_fields",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

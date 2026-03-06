"""Parameter Fields SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.parameter_fields.search import (
    search_parameter_fields as search_parameter_fields_fn,
)
from app.sql.types import (
    SearchParameterFieldsApiRequest,
    SearchParameterFieldsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

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
    """Search parameter fields resources by parameter IDs."""
    tags = ["resources", "parameter_fields"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_parameter_fields_fn(
            conn,
            get_redis_client(),
            limit_count=20,
            offset_count=0,
            parameter_ids=request.p_parameter_ids,
            field_ids=request.p_field_ids,
            conditional_parameter_ids=request.p_conditional_parameter_ids,
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
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

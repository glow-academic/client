"""Parameters SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.parameters.search import search_parameters as search_parameters_fn
from app.sql.types import (
    SearchParametersApiRequest,
    SearchParametersApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/parameters/search",
    response_model=SearchParametersApiResponse,
)
async def search_parameters(
    request: SearchParametersApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchParametersApiResponse:
    """Search parameters resources."""
    tags = ["resources", "parameters"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_parameters_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            department_ids=request.department_ids,
            field_ids=request.field_ids,
            persona_parameter=request.p_persona_parameter,
            document_parameter=request.p_document_parameter,
            scenario_parameter=request.p_scenario_parameter,
            video_parameter=request.p_video_parameter,
            bypass_cache=bypass_cache,
            document=request.document or False,
            parameter=request.parameter or False,
            persona=request.persona or False,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchParametersApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_parameters",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

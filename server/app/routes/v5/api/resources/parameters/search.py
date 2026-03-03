"""Parameters SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.parameters.search import (
    SQL_PATH,
    search_parameters_internal,
)
from app.sql.types import (
    SearchParametersApiRequest,
    SearchParametersApiResponse,
    load_sql_query,
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
    tags = ["resources", "parameters"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_parameters_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.p_persona_parameter,
            request.p_document_parameter,
            request.p_scenario_parameter,
            request.p_video_parameter,
            request.suggest_source,
            request.exclude_ids,
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
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

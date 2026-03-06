"""Fields SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.fields.search import (
    search_fields as search_fields_fn,
)
from app.sql.types import (
    SearchFieldsApiRequest,
    SearchFieldsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/fields/search",
    response_model=SearchFieldsApiResponse,
)
async def search_fields(
    request: SearchFieldsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchFieldsApiResponse:
    tags = ["resources", "fields"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_fields_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            draft_id=request.draft_id,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            department_ids=request.department_ids,
            conditional_parameter_ids=request.conditional_parameter_ids,
            bypass_cache=bypass_cache,
            field=request.field or False,
            parameter=request.parameter or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchFieldsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_fields",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

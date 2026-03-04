"""Descriptions SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.descriptions.search import (
    SQL_PATH,
    search_descriptions_internal,
)
from app.sql.types import (
    SearchDescriptionsApiRequest,
    SearchDescriptionsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/descriptions/search",
    response_model=SearchDescriptionsApiResponse,
)
async def search_descriptions(
    request: SearchDescriptionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchDescriptionsApiResponse:
    tags = ["resources", "descriptions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_descriptions_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.draft_id,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache,
            agent=request.agent or False,
            auth=request.auth or False,
            cohort=request.cohort or False,
            department=request.department or False,
            document=request.document or False,
            eval=request.eval or False,
            field=request.field or False,
            model=request.model or False,
            parameter=request.parameter or False,
            persona=request.persona or False,
            provider=request.provider or False,
            rubric=request.rubric or False,
            scenario=request.scenario or False,
            setting=request.setting or False,
            simulation=request.simulation or False,
            tool=request.tool or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchDescriptionsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_descriptions",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

"""Departments SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.departments.search import (
    SQL_PATH,
    search_departments_internal,
)
from app.sql.types import (
    SearchDepartmentsApiRequest,
    SearchDepartmentsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/departments/search",
    response_model=SearchDepartmentsApiResponse,
)
async def search_departments(
    request: SearchDepartmentsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchDepartmentsApiResponse:
    tags = ["resources", "departments"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_departments_internal(
            conn,
            search=request.search,
            limit_count=request.limit_count,
            offset_count=request.offset_count,
            department_ids=request.department_ids,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
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
            profile=request.profile or False,
            provider=request.provider or False,
            rubric=request.rubric or False,
            scenario=request.scenario or False,
            setting=request.setting or False,
            simulation=request.simulation or False,
            tool=request.tool or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchDepartmentsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_departments",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

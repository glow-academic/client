"""Departments SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.departments.types import SearchDepartmentsParams
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetDepartmentsV4Item,
    SearchDepartmentsApiRequest,
    SearchDepartmentsApiResponse,
    SearchDepartmentsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/departments/search_departments_complete.sql"

router = APIRouter()


async def search_departments_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    user_department_ids: list[UUID] | None = None,
    draft_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    agent: bool = False,
    auth: bool = False,
    cohort: bool = False,
    department: bool = False,
    document: bool = False,
    eval: bool = False,
    field: bool = False,
    model: bool = False,
    parameter: bool = False,
    persona: bool = False,
    profile: bool = False,
    provider: bool = False,
    rubric: bool = False,
    scenario: bool = False,
    setting: bool = False,
    simulation: bool = False,
    tool: bool = False,
) -> list[QGetDepartmentsV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "departments"]
    cache_key_val = cache_key(
        "/api/v4/resources/departments/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "user_department_ids": [str(id) for id in (user_department_ids or [])],
            "draft_id": str(draft_id) if draft_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "agent": agent,
            "auth": auth,
            "cohort": cohort,
            "department": department,
            "document": document,
            "eval": eval,
            "field": field,
            "model": model,
            "parameter": parameter,
            "persona": persona,
            "profile": profile,
            "provider": provider,
            "rubric": rubric,
            "scenario": scenario,
            "setting": setting,
            "simulation": simulation,
            "tool": tool,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetDepartmentsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchDepartmentsParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        user_department_ids=user_department_ids or [],
        draft_id=draft_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        agent=agent,
        auth=auth,
        cohort=cohort,
        department=department,
        document=document,
        eval=eval,
        field=field,
        model=model,
        parameter=parameter,
        persona=persona,
        profile=profile,
        provider=provider,
        rubric=rubric,
        scenario=scenario,
        setting=setting,
        simulation=simulation,
        tool=tool,
    )
    result = cast(
        SearchDepartmentsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetDepartmentsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


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
            request.search,
            request.limit_count,
            request.offset_count,
            request.user_department_ids,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache,
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

"""Flags SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    QGetFlagsV4Item,
    SearchFlagsApiRequest,
    SearchFlagsApiResponse,
    SearchFlagsSqlParams,
    SearchFlagsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/flags/search_flags_complete.sql"

router = APIRouter()


async def search_flags_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    flag_type: str | None = None,
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
) -> list[QGetFlagsV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "flags"]
    cache_key_val = cache_key(
        "/api/v5/resources/flags/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "flag_type": flag_type,
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
                QGetFlagsV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = SearchFlagsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        flag_type=flag_type,
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
        SearchFlagsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetFlagsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/flags/search",
    response_model=SearchFlagsApiResponse,
)
async def search_flags(
    request: SearchFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchFlagsApiResponse:
    tags = ["resources", "flags"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_flags_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
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
        return SearchFlagsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_flags",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

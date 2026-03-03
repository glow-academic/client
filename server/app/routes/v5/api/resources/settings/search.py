"""Settings SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.sql.types import (
    QGetSettingsV4Item,
    SearchSettingsApiRequest,
    SearchSettingsApiResponse,
    SearchSettingsSqlParams,
    SearchSettingsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/queries/resources/settings/search_settings_complete.sql"

router = APIRouter()


async def search_settings_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    agent_ids: list[UUID] | None = None,
    provider_key_ids: list[UUID] | None = None,
    auth_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    department: bool = False,
    setting: bool = False,
) -> list[QGetSettingsV4Item]:
    """Internal function to search settings."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "settings"]
    cache_key_val = cache_key(
        "/api/v5/resources/settings/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "agent_ids": sorted(str(i) for i in (agent_ids or [])),
            "provider_key_ids": sorted(str(i) for i in (provider_key_ids or [])),
            "auth_ids": sorted(str(i) for i in (auth_ids or [])),
            "department": department,
            "setting": setting,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetSettingsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchSettingsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        agent_ids=agent_ids or [],
        provider_key_ids=provider_key_ids or [],
        auth_ids=auth_ids or [],
        department=department,
        setting=setting,
    )
    result = cast(
        SearchSettingsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetSettingsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/settings/search",
    response_model=SearchSettingsApiResponse,
)
async def search_settings(
    request: SearchSettingsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSettingsApiResponse:
    """Search settings resources."""
    tags = ["resources", "settings"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_settings_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            department=request.department or False,
            setting=request.setting or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchSettingsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_settings",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

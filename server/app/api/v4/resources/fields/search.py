"""Fields SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.fields.types import SearchFieldsParams
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetFieldsV4Item,
    SearchFieldsApiRequest,
    SearchFieldsApiResponse,
    SearchFieldsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/fields/search_fields_complete.sql"

router = APIRouter()


async def search_fields_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    department_ids: list[UUID] | None = None,
    draft_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    conditional_parameter_ids: list[UUID] | None = None,
    parameter_id: UUID | None = None,
    bypass_cache: bool = False,
    *,
    field: bool = False,
    parameter: bool = False,
) -> list[QGetFieldsV4Item]:
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "fields"]
    cache_key_val = cache_key(
        "/api/v4/resources/fields/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "department_ids": [str(id) for id in (department_ids or [])],
            "draft_id": str(draft_id) if draft_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "conditional_parameter_ids": sorted(
                str(i) for i in (conditional_parameter_ids or [])
            ),
            "parameter_id": str(parameter_id) if parameter_id else None,
            "field": field,
            "parameter": parameter,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetFieldsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchFieldsParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        department_ids=department_ids or [],
        draft_id=draft_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        conditional_parameter_ids=conditional_parameter_ids or [],
        field=field,
        parameter=parameter,
    )
    result = cast(
        SearchFieldsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetFieldsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


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
        items = await search_fields_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.department_ids,
            request.draft_id,
            request.suggest_source,
            request.exclude_ids,
            request.parameter_id,
            bypass_cache,
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
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

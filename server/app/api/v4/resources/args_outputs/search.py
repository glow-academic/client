"""ArgsOutputs SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.args_outputs.types import SearchArgsOutputsParams
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetArgsOutputsV4Item,
    SearchArgsOutputsApiRequest,
    SearchArgsOutputsApiResponse,
    SearchArgsOutputsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/args_outputs/search_args_outputs_complete.sql"

router = APIRouter()


async def search_args_outputs_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    draft_id: UUID | None = None,
    suggest_source: str | None = None,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    args_ids: list[UUID] | None = None,
    tool: bool = False,
) -> list[QGetArgsOutputsV4Item]:
    """Internal function to search args_outputs."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "args_outputs"]
    cache_key_val = cache_key(
        "/api/v4/resources/args_outputs/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "draft_id": str(draft_id) if draft_id else None,
            "suggest_source": suggest_source,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "args_ids": [str(id) for id in (args_ids or [])],
            "tool": tool,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetArgsOutputsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchArgsOutputsParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        draft_id=draft_id,
        suggest_source=suggest_source,
        exclude_ids=exclude_ids or [],
        args_ids=args_ids or [],
        tool=tool,
    )
    result = cast(
        SearchArgsOutputsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetArgsOutputsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/args_outputs/search",
    response_model=SearchArgsOutputsApiResponse,
)
async def search_args_outputs(
    request: SearchArgsOutputsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchArgsOutputsApiResponse:
    """Search args_outputs resources."""
    tags = ["resources", "args_outputs"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_args_outputs_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.draft_id,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache,
            args_ids=getattr(request, "args_ids", None),
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchArgsOutputsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_args_outputs",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

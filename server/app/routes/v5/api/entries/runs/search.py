"""Runs entry SEARCH endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    SearchRunsEntriesApiRequest,
    SearchRunsEntriesApiResponse,
    SearchRunsEntriesSqlParams,
    SearchRunsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SEARCH_SQL_PATH = "app/sql/queries/entries/runs/search_runs_entries_complete.sql"
LIST_SQL_PATH = "app/sql/queries/views/run/list/get_run_list_view_complete.sql"

router = APIRouter()

# ---------------------------------------------------------------------------
# Types (merged from types.py)
# ---------------------------------------------------------------------------


class RunPricingItem(BaseModel):
    """Single pricing entry for a run. Cost computed at runtime."""

    pricing_type: str | None = None
    count: int = 0
    pricing_id: UUID | None = None


class RunViewItem(BaseModel):
    """Single run from the run list."""

    run_id: UUID
    group_id: UUID | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    run_created_at: datetime | None = None
    agent_ids: list[UUID] | None = None
    model_ids: list[UUID] | None = None
    provider_ids: list[UUID] | None = None
    pricing: list[RunPricingItem] = Field(default_factory=list)


class GetRunListViewResponse(BaseModel):
    """Response containing run list data."""

    items: list[RunViewItem] = Field(default_factory=list, description="Run data items")
    total_count: int = Field(default=0, description="Total count before pagination")


# ---------------------------------------------------------------------------
# Search (original search.py)
# ---------------------------------------------------------------------------


async def search_runs_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    group_id: UUID | None = None,
    input_pricing_pricing_id: UUID | None = None,
    output_pricing_pricing_id: UUID | None = None,
    cached_pricing_pricing_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search runs entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "runs"]
    cache_key_val = cache_key(
        "/api/v5/entries/runs/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "group_id": str(group_id) if group_id else None,
            "input_pricing_pricing_id": str(input_pricing_pricing_id)
            if input_pricing_pricing_id
            else None,
            "output_pricing_pricing_id": str(output_pricing_pricing_id)
            if output_pricing_pricing_id
            else None,
            "cached_pricing_pricing_id": str(cached_pricing_pricing_id)
            if cached_pricing_pricing_id
            else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchRunsEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        group_id=group_id,
        input_pricing_pricing_id=input_pricing_pricing_id,
        output_pricing_pricing_id=output_pricing_pricing_id,
        cached_pricing_pricing_id=cached_pricing_pricing_id,
    )
    result = cast(
        SearchRunsEntriesSqlRow,
        await execute_sql_typed(conn, SEARCH_SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/runs/search",
    response_model=SearchRunsEntriesApiResponse,
)
async def search_runs_entries(
    request: SearchRunsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchRunsEntriesApiResponse:
    """Search runs entries."""
    tags = ["entries", "runs"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_runs_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchRunsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_runs_entries",
            sql_query=load_sql_query(SEARCH_SQL_PATH),
            sql_params=None,
            request=http_request,
        )


# ---------------------------------------------------------------------------
# List (merged from list.py)
# ---------------------------------------------------------------------------


def _build_pricing_list(item: object) -> list[RunPricingItem]:
    """Build pricing list from flat columns."""
    pricing: list[RunPricingItem] = []
    if getattr(item, "input_pricing_count", None) is not None:
        pricing.append(
            RunPricingItem(
                pricing_type="input",
                count=item.input_pricing_count or 0,
                pricing_id=item.input_pricing_pricing_id,
            )
        )
    if getattr(item, "output_pricing_count", None) is not None:
        pricing.append(
            RunPricingItem(
                pricing_type="output",
                count=item.output_pricing_count or 0,
                pricing_id=item.output_pricing_pricing_id,
            )
        )
    if getattr(item, "cached_pricing_count", None) is not None:
        pricing.append(
            RunPricingItem(
                pricing_type="cached",
                count=item.cached_pricing_count or 0,
                pricing_id=item.cached_pricing_pricing_id,
            )
        )
    return pricing


async def get_run_list_entries_internal(
    conn: asyncpg.Connection,
    group_id_filter: UUID | None = None,
    group_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
    profile_id_filter: UUID | None = None,
) -> GetRunListViewResponse:
    """Internal function for fetching run data from runs_mv."""
    from app.sql.types import GetRunListViewSqlParams

    cache_key_val = cache_key(
        "entries/run/list/get",
        {
            "group_id_filter": str(group_id_filter) if group_id_filter else None,
            "group_ids": [str(g) for g in group_ids] if group_ids else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetRunListViewResponse.model_validate(cached)

    params = GetRunListViewSqlParams(
        group_id_filter=group_id_filter,
        group_ids=group_ids,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
        profile_id_filter=profile_id_filter,
    )

    result = await execute_sql_typed(conn, LIST_SQL_PATH, params=params)

    items: list[RunViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                RunViewItem(
                    run_id=item.run_id,
                    group_id=item.group_id,
                    input_tokens=item.input_tokens or 0,
                    output_tokens=item.output_tokens or 0,
                    cached_input_tokens=item.cached_input_tokens or 0,
                    run_created_at=item.run_created_at,
                    agent_ids=list(item.agent_ids) if item.agent_ids else None,
                    model_ids=list(item.model_ids) if item.model_ids else None,
                    provider_ids=list(item.provider_ids) if item.provider_ids else None,
                    pricing=_build_pricing_list(item),
                )
            )

    response = GetRunListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "run", "list"],
    )

    return response

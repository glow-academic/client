"""Attempt entry SEARCH endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    GetAttemptListViewSqlRow,
    QGetAttemptListViewV4Option,
    SearchAttemptEntriesApiRequest,
    SearchAttemptEntriesApiResponse,
    SearchAttemptEntriesSqlParams,
    SearchAttemptEntriesSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/attempt/search_attempt_entries_complete.sql"

router = APIRouter()

# ---------------------------------------------------------------------------
# Internal: search attempt entries
# ---------------------------------------------------------------------------


async def search_attempt_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    simulation_id: UUID | None = None,
    profile_id: UUID | None = None,
    cohort_id: UUID | None = None,
    department_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search attempt entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "attempt"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "simulation_id": str(simulation_id) if simulation_id else None,
            "profile_id": str(profile_id) if profile_id else None,
            "cohort_id": str(cohort_id) if cohort_id else None,
            "department_id": str(department_id) if department_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchAttemptEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        simulation_id=simulation_id,
        profile_id=profile_id,
        cohort_id=cohort_id,
        department_id=department_id,
    )
    result = cast(
        SearchAttemptEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items


# ---------------------------------------------------------------------------
# Internal: get attempt list
# ---------------------------------------------------------------------------

LIST_SQL_PATH = (
    "app/v5/sql/queries/views/attempt/list/get_attempt_list_view_complete.sql"
)


async def get_attempt_list_internal(
    conn: asyncpg.Connection,
    attempt_ids: list[UUID] | None = None,
    profile_id_filter: UUID | None = None,
    simulation_id_filter: UUID | None = None,
    practice_filter: bool | None = None,
    is_archived_filter: bool | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    scenario_ids_filter: list[UUID] | None = None,
    infinite_mode_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetAttemptListViewSqlRow:
    """Internal function for fetching attempt data."""
    from app.v5.sql.types import GetAttemptListViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt/list/get",
        {
            "attempt_ids": [str(a) for a in attempt_ids] if attempt_ids else None,
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "simulation_id_filter": str(simulation_id_filter)
            if simulation_id_filter
            else None,
            "practice_filter": practice_filter,
            "is_archived_filter": is_archived_filter,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "scenario_ids_filter": [str(s) for s in scenario_ids_filter]
            if scenario_ids_filter
            else None,
            "infinite_mode_filter": infinite_mode_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetAttemptListViewSqlRow.model_validate(cached)

    params = GetAttemptListViewSqlParams(
        attempt_ids=attempt_ids,
        profile_id_filter=profile_id_filter,
        simulation_id_filter=simulation_id_filter,
        practice_filter=practice_filter,
        is_archived_filter=is_archived_filter,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        scenario_ids_filter=scenario_ids_filter,
        infinite_mode_filter=infinite_mode_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, LIST_SQL_PATH, params=params)

    # Filter out options with empty values
    simulation_options: list[QGetAttemptListViewV4Option] | None = None
    if result and result.simulation_options:
        simulation_options = [opt for opt in result.simulation_options if opt.value]

    scenario_options: list[QGetAttemptListViewV4Option] | None = None
    if result and result.scenario_options:
        scenario_options = [opt for opt in result.scenario_options if opt.value]

    profile_options: list[QGetAttemptListViewV4Option] | None = None
    if result and result.profile_options:
        profile_options = [opt for opt in result.profile_options if opt.value]

    response = GetAttemptListViewSqlRow(
        items=result.items if result else None,
        total_count=result.total_count or 0 if result else 0,
        simulation_options=simulation_options,
        scenario_options=scenario_options,
        profile_options=profile_options,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "attempt", "list"],
    )

    return response


# ---------------------------------------------------------------------------
# Router handler
# ---------------------------------------------------------------------------


@router.post(
    "/attempt/search",
    response_model=SearchAttemptEntriesApiResponse,
)
async def search_attempt_entries(
    request: SearchAttemptEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchAttemptEntriesApiResponse:
    """Search attempt entries."""
    tags = ["entries", "attempt"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_attempt_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchAttemptEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_attempt_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

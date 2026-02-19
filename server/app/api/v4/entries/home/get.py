"""Home entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeEntriesApiRequest,
    GetHomeEntriesApiResponse,
    GetHomeEntriesSqlParams,
    GetHomeEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/home/get_home_entries_complete.sql"
VIEW_SQL_PATH = "app/sql/v4/queries/views/home/context/get_home_context_view_complete.sql"

router = APIRouter()


class HomeContextViewItem(BaseModel):
    """IDs-first home simulation item — raw IDs only, no computed fields."""

    simulation_id: UUID
    training_entry_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None
    time_limit_ids: list[UUID] | None = None


class GetHomeContextViewResponse(BaseModel):
    """View-layer response for home context."""

    actor_name: str | None = None
    user_role: str | None = None
    items: list[HomeContextViewItem] = Field(default_factory=list)


async def get_home_context_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> GetHomeContextViewResponse:
    """Internal function for IDs-first home context data."""
    from app.sql.types import GetHomeContextViewSqlParams

    cache_key_val = cache_key(
        "views/home/context/get",
        {"profile_id": str(profile_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetHomeContextViewResponse.model_validate(cached)

    params = GetHomeContextViewSqlParams(
        profile_id_filter=profile_id,
    )
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[HomeContextViewItem] = []
    if result and result.items:
        for item in result.items:
            if not item.simulation_id:
                continue
            items.append(
                HomeContextViewItem(
                    simulation_id=item.simulation_id,
                    training_entry_ids=(
                        list(item.training_entry_ids)
                        if item.training_entry_ids
                        else None
                    ),
                    scenario_ids=list(item.scenario_ids) if item.scenario_ids else None,
                    cohort_ids=list(item.cohort_ids) if item.cohort_ids else None,
                    persona_ids=(list(item.persona_ids) if item.persona_ids else None),
                    rubric_ids=(list(item.rubric_ids) if item.rubric_ids else None),
                    time_limit_ids=(
                        list(item.time_limit_ids) if item.time_limit_ids else None
                    ),
                )
            )

    response = GetHomeContextViewResponse(
        items=items,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "home", "context"],
    )

    return response


async def get_home_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch home entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "home"]
    cache_key_val = cache_key(
        "/api/v4/entries/home/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetHomeEntriesSqlParams(ids=ids)
    result = cast(
        GetHomeEntriesSqlRow,
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


@router.post(
    "/home/get",
    response_model=GetHomeEntriesApiResponse,
)
async def get_home_entries(
    request: GetHomeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeEntriesApiResponse:
    """Get home entries by IDs."""
    tags = ["entries", "home"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_home_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetHomeEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_home_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

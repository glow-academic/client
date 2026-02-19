"""Practice entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPracticeEntriesApiRequest,
    GetPracticeEntriesApiResponse,
    GetPracticeEntriesSqlParams,
    GetPracticeEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/practice/get_practice_entries_complete.sql"
VIEW_SQL_PATH = (
    "app/sql/v4/queries/views/practice/context/get_practice_context_view_complete.sql"
)

router = APIRouter()


class PracticeContextViewItem(BaseModel):
    """IDs-first practice simulation item — raw IDs only, no computed fields."""

    simulation_id: UUID
    training_entry_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None
    time_limit_ids: list[UUID] | None = None


class GetPracticeContextViewResponse(BaseModel):
    """View-layer response for practice context."""

    actor_name: str | None = None
    user_role: str | None = None
    items: list[PracticeContextViewItem] = Field(default_factory=list)


async def get_practice_context_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> GetPracticeContextViewResponse:
    """Internal function for IDs-first practice context data."""
    from app.sql.types import GetPracticeContextViewSqlParams

    cache_key_val = cache_key(
        "views/practice/context/get",
        {"profile_id": str(profile_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetPracticeContextViewResponse.model_validate(cached)

    params = GetPracticeContextViewSqlParams(
        profile_id_filter=profile_id,
    )
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[PracticeContextViewItem] = []
    if result and result.items:
        for item in result.items:
            if not item.simulation_id:
                continue
            items.append(
                PracticeContextViewItem(
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

    response = GetPracticeContextViewResponse(
        items=items,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "practice", "context"],
    )

    return response


async def get_practice_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch practice entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "practice"]
    cache_key_val = cache_key(
        "/api/v4/entries/practice/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetPracticeEntriesSqlParams(ids=ids)
    result = cast(
        GetPracticeEntriesSqlRow,
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
    "/practice/get",
    response_model=GetPracticeEntriesApiResponse,
)
async def get_practice_entries(
    request: GetPracticeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPracticeEntriesApiResponse:
    """Get practice entries by IDs."""
    tags = ["entries", "practice"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_practice_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetPracticeEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_practice_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

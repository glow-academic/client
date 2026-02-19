"""Attempt Grade entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetAttemptGradeEntriesApiRequest,
    GetAttemptGradeEntriesApiResponse,
    GetAttemptGradeEntriesSqlParams,
    GetAttemptGradeEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/attempt_grade/get_attempt_grade_entries_complete.sql"
)
VIEW_SQL_PATH = (
    "app/sql/v4/queries/views/simulation/grades/get_simulation_grades_view_complete.sql"
)

router = APIRouter()


class GradeViewItem(BaseModel):
    """A single grades view item."""

    grade_id: UUID
    chat_id: UUID | None = None
    score: float | None = None
    passed: bool | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None
    rubric_id: UUID | None = None
    created_at: datetime | None = None


async def get_attempt_grade_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_grade entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_grade"]
    cache_key_val = cache_key(
        "/api/v4/entries/attempt_grade/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptGradeEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptGradeEntriesSqlRow,
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


async def get_attempt_grade_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GradeViewItem]:
    """Internal function for fetching grades data."""
    from app.sql.types import GetSimulationGradesViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_grade/view",
        {
            "chat_ids": [str(x) for x in chat_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [GradeViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationGradesViewSqlParams(chat_ids_filter=chat_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[GradeViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                GradeViewItem(
                    grade_id=item.grade_id,
                    chat_id=item.chat_id,
                    score=float(item.score) if item.score is not None else None,
                    passed=item.passed,
                    time_taken=item.time_taken,
                    total_points=item.total_points,
                    pass_points=item.pass_points,
                    rubric_id=item.rubric_id,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_grade"],
    )
    return items


@router.post(
    "/attempt_grade/get",
    response_model=GetAttemptGradeEntriesApiResponse,
)
async def get_attempt_grade_entries(
    request: GetAttemptGradeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptGradeEntriesApiResponse:
    """Get attempt_grade entries by IDs."""
    tags = ["entries", "attempt_grade"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_grade_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptGradeEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_grade_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

"""Training entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    GetTrainingEntriesApiRequest,
    GetTrainingEntriesApiResponse,
    GetTrainingEntriesSqlParams,
    GetTrainingEntriesSqlRow,
    GetTrainingViewSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/training/get_training_entries_complete.sql"
VIEW_SQL_PATH = (
    "app/sql/queries/views/training/bundle/get_training_view_complete.sql"
)

router = APIRouter()


async def get_training_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch training entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "training"]
    cache_key_val = cache_key(
        "/api/v5/entries/training/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetTrainingEntriesSqlParams(ids=ids)
    result = cast(
        GetTrainingEntriesSqlRow,
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


async def get_training_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    chat_entry_id: UUID,
) -> GetTrainingViewSqlRow:
    """Thin MV-backed bundle scope lookup used by training artifacts."""
    from app.sql.types import GetTrainingViewSqlParams

    params = GetTrainingViewSqlParams(
        profile_id_filter=profile_id,
        chat_entry_id_filter=chat_entry_id,
    )
    row = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    if not row:
        return GetTrainingViewSqlRow()

    return GetTrainingViewSqlRow(
        profile_has_access=row.profile_has_access or False,
        chat_entry_id=row.chat_entry_id,
        parent_id=row.parent_id,
        scenario_id=row.scenario_id,
        department_ids=list(row.department_ids or []),
        persona_ids=list(row.persona_ids or []),
        document_ids=list(row.document_ids or []),
        parameter_field_ids=list(row.parameter_field_ids or []),
        question_ids=list(row.question_ids or []),
        option_ids=list(row.option_ids or []),
        video_ids=list(row.video_ids or []),
        image_ids=list(row.image_ids or []),
        problem_statement_ids=list(row.problem_statement_ids or []),
        objective_ids=list(row.objective_ids or []),
        flag_ids=list(row.flag_ids or []),
        name_ids=list(row.name_ids or []),
        description_ids=list(row.description_ids or []),
        video_enabled=row.video_enabled or False,
        problem_statement_enabled=row.problem_statement_enabled or False,
        objectives_enabled=row.objectives_enabled or False,
        images_enabled=row.images_enabled or False,
        questions_enabled=row.questions_enabled or False,
    )


@router.post(
    "/training/get",
    response_model=GetTrainingEntriesApiResponse,
)
async def get_training_entries(
    request: GetTrainingEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTrainingEntriesApiResponse:
    """Get training entries by IDs."""
    tags = ["entries", "training"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_training_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTrainingEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_training_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )

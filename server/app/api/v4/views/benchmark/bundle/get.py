"""Get endpoint for benchmark bundle view."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.views.benchmark.bundle.types import GetSuiteViewResponse
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/benchmark/bundle/get_suite_view_complete.sql"
)

router = APIRouter()


async def get_suite_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    suite_entry_id: UUID,
) -> GetSuiteViewResponse:
    """Thin MV-backed bundle scope lookup used by benchmark artifacts."""
    from app.sql.types import GetSuiteViewSqlParams

    params = GetSuiteViewSqlParams(
        profile_id_filter=profile_id,
        suite_entry_id_filter=suite_entry_id,
    )
    row = await execute_sql_typed(conn, SQL_PATH, params=params)

    if not row:
        return GetSuiteViewResponse()

    return GetSuiteViewResponse(
        profile_has_access=row.profile_has_access or False,
        suite_entry_id=row.suite_entry_id,
        benchmark_id=row.benchmark_id,
        department_ids=list(row.department_ids or []),
        model_ids=list(row.model_ids or []),
        prompt_ids=list(row.prompt_ids or []),
        instruction_ids=list(row.instruction_ids or []),
        voice_ids=list(row.voice_ids or []),
        temperature_level_ids=list(row.temperature_level_ids or []),
        reasoning_level_ids=list(row.reasoning_level_ids or []),
        tool_ids=list(row.tool_ids or []),
        key_ids=list(row.key_ids or []),
        flag_ids=list(row.flag_ids or []),
        name_ids=list(row.name_ids or []),
        description_ids=list(row.description_ids or []),
    )


@router.post("/get", response_model=GetSuiteViewResponse)
async def get_suite_view(
    request: Request,
    suite_entry_id: UUID,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSuiteViewResponse:
    """Get thin bundle scope for a single benchmark bundle entry."""
    try:
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(status_code=401, detail="Profile ID is required")

        return await get_suite_view_internal(
            conn=conn,
            profile_id=cast(UUID, profile_id),
            suite_entry_id=suite_entry_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="views_suite_get",
            sql_query=None,
            sql_params=None,
            request=request,
        )

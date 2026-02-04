"""Internal query for first-attempt pass rows (beta parity semantics)."""

from typing import cast

import asyncpg
from pydantic import BaseModel

from app.api.v4.views.analytics.first_attempt_pass.types import (
    FirstAttemptPassItem,
    GetFirstAttemptPassRequest,
    GetFirstAttemptPassResponse,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/first_attempt_pass/get_analytics_first_attempt_pass_view_complete.sql"


class GetFirstAttemptPassSqlParams(BaseModel):
    profile_id: str | None = None
    cohort_ids: list[str] | None = None
    department_ids: list[str] | None = None
    attempt_type_filter: str | None = None
    is_archived_filter: bool = False
    date_from: str | None = None
    date_to: str | None = None


class GetFirstAttemptPassSqlRow(BaseModel):
    items: list | None = None


async def get_first_attempt_pass_internal(
    conn: asyncpg.Connection,
    request: GetFirstAttemptPassRequest,
) -> GetFirstAttemptPassResponse:
    """Fetch earliest attempt rows all-time, then apply date window filter."""
    result = cast(
        GetFirstAttemptPassSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=GetFirstAttemptPassSqlParams(
                profile_id=str(request.profile_id) if request.profile_id else None,
                cohort_ids=[str(c) for c in request.cohort_ids]
                if request.cohort_ids
                else None,
                department_ids=[str(d) for d in request.department_ids]
                if request.department_ids
                else None,
                attempt_type_filter=request.attempt_type,
                is_archived_filter=request.is_archived,
                date_from=request.date_from.isoformat() if request.date_from else None,
                date_to=request.date_to.isoformat() if request.date_to else None,
            ),
        ),
    )
    items: list[FirstAttemptPassItem] = []
    if result and result.items:
        for row in result.items:
            items.append(
                FirstAttemptPassItem(
                    attempt_id=row.attempt_id,
                    profile_id=row.profile_id,
                    simulation_id=row.simulation_id,
                    attempt_created_at=row.attempt_created_at,
                    grade_percent=float(row.grade_percent)
                    if row.grade_percent is not None
                    else None,
                    rubric_pass_points=row.rubric_pass_points,
                    rubric_total_points=row.rubric_total_points,
                )
            )
    return GetFirstAttemptPassResponse(items=items)

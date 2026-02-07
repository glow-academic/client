"""Internal query for first-attempt pass rows (beta parity semantics)."""

from datetime import UTC, datetime
from typing import cast

import asyncpg

from app.api.v4.views.analytics.first_attempt_pass.types import (
    FirstAttemptPassItem,
    GetFirstAttemptPassRequest,
    GetFirstAttemptPassResponse,
)
from app.sql.types import (
    GetAnalyticsFirstAttemptPassViewSqlParams,
    GetAnalyticsFirstAttemptPassViewSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/first_attempt_pass/get_analytics_first_attempt_pass_view_complete.sql"


async def get_first_attempt_pass_internal(
    conn: asyncpg.Connection,
    request: GetFirstAttemptPassRequest,
) -> GetFirstAttemptPassResponse:
    """Fetch earliest attempt rows all-time, then apply date window filter."""
    now = datetime.now(UTC)
    date_from = request.date_from or now.replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    date_to = request.date_to or now

    result = cast(
        GetAnalyticsFirstAttemptPassViewSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=GetAnalyticsFirstAttemptPassViewSqlParams(
                profile_id=request.profile_id,
                cohort_ids=request.cohort_ids,
                department_ids=request.department_ids,
                attempt_type_filter=request.attempt_type,
                is_archived_filter=request.is_archived,
                date_from=date_from,
                date_to=date_to,
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

"""Internal query for rubric group scores used by dashboard heatmap."""

from typing import cast
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.api.v4.views.analytics.rubric_group_scores.types import (
    GetRubricGroupScoresResponse,
    RubricGroupScoreItem,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/rubric_group_scores/get_analytics_rubric_group_scores_view_complete.sql"


class GetRubricGroupScoresSqlParams(BaseModel):
    chat_ids: list[UUID]


class GetRubricGroupScoresSqlRow(BaseModel):
    items: list | None = None


async def get_rubric_group_scores_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
) -> GetRubricGroupScoresResponse:
    """Fetch per-chat rubric standard-group scores for provided chat IDs."""
    if not chat_ids:
        return GetRubricGroupScoresResponse(items=[])

    result = cast(
        GetRubricGroupScoresSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=GetRubricGroupScoresSqlParams(chat_ids=chat_ids),
        ),
    )

    items: list[RubricGroupScoreItem] = []
    if result and result.items:
        for row in result.items:
            items.append(
                RubricGroupScoreItem(
                    chat_id=row.chat_id,
                    rubric_id=row.rubric_id,
                    standard_group_id=row.standard_group_id,
                    group_name=row.group_name,
                    group_short_name=row.group_short_name,
                    score_percent=float(row.score_percent)
                    if row.score_percent is not None
                    else None,
                )
            )
    return GetRubricGroupScoresResponse(items=items)

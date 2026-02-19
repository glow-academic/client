"""ResponseViewItem view function (migrated from views/simulation/responses)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/responses/get_simulation_responses_view_complete.sql"


class ResponseViewItem(BaseModel):
    """A single responses view item."""

    response_id: UUID
    chat_id: UUID | None = None
    question_id: UUID | None = None
    option_id: UUID | None = None
    created_at: datetime | None = None


async def get_simulation_responses_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[ResponseViewItem]:
    """Internal function for fetching responses data."""
    from app.sql.types import GetSimulationResponsesViewSqlParams

    cache_key_val = cache_key(
        "entries/responses/view",
        {
        "chat_ids": [str(x) for x in chat_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ResponseViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationResponsesViewSqlParams(chat_ids_filter=chat_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ResponseViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ResponseViewItem(
                    response_id=item.response_id,
                    chat_id=item.chat_id,
                    question_id=item.question_id,
                    option_id=item.option_id,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "responses"],
    )
    return items

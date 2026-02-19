"""MessageTreeViewItem view function (migrated from views/simulation/message_tree)."""

from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/message_tree/get_attempt_message_tree_view_complete.sql"


class MessageTreeViewItem(BaseModel):
    """A single message_tree view item."""

    message_id: UUID
    branch_path: list[UUID] | None = None
    depth: int | None = None


async def get_attempt_message_tree_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[MessageTreeViewItem]:
    """Internal function for fetching message_tree data."""
    from app.sql.types import GetSimulationMessageTreeViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_message_tree/view",
        {
        "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [MessageTreeViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationMessageTreeViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[MessageTreeViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                MessageTreeViewItem(
                    message_id=item.message_id,
                    branch_path=list(item.branch_path) if item.branch_path else None,
                    depth=item.depth,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_message_tree"],
    )
    return items

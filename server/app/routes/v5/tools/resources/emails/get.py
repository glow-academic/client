"""emails/get internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    GetEmailsSqlParams,
    GetEmailsSqlRow,
    QGetEmailsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/emails/get_emails_complete.sql"


async def get_emails_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetEmailsV4Item]:
    """Internal function to fetch emails by IDs."""
    if not ids:
        return []

    tags = ["resources", "emails"]
    cache_key_val = cache_key(
        "/api/v5/resources/emails/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetEmailsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetEmailsSqlParams(ids=ids)
    result = cast(
        GetEmailsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetEmailsV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
        redis=get_redis_client(),
    )

    return items

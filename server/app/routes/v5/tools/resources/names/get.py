"""Names GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.resources.names.types import NameItem
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import load_sql

SQL_PATH = "app/sql/queries/resources/names/get_names.sql"


async def get_names(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[NameItem]:
    """Fetch names by IDs."""
    if not ids:
        return []

    tags = ["resources", "names"]
    cache_key_val = cache_key(
        "/api/v5/resources/names/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [NameItem.model_validate(item) for item in cached.get("items", [])]

    sql = load_sql(SQL_PATH)
    rows = await conn.fetch(sql, ids)
    items = [NameItem(id=r["id"], name=r["name"], generated=r["generated"]) for r in rows]

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

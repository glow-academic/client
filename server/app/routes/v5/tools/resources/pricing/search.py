"""pricing/search internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetPricingV4Item,
    SearchPricingSqlParams,
    SearchPricingSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/pricing/search_pricing_complete.sql"

async def search_pricing_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    pricing_type: str | None = None,
    unit_names: list[str] | None = None,
    bypass_cache: bool = False,
    *,
    model: bool = False,
) -> list[QGetPricingV4Item]:
    """Internal function to search pricing."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "pricing"]
    cache_key_val = cache_key(
        "/api/v5/resources/pricing/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "pricing_type": pricing_type,
            "unit_names": sorted(unit_names or []),
            "model": model,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetPricingV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchPricingSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        pricing_type=pricing_type,
        unit_names=unit_names or [],
        model=model,
    )
    result = cast(
        SearchPricingSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetPricingV4Item] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items

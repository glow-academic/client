"""Shared pricing computation from RunViewItem.pricing data.

Batch-fetches pricing_resource and artifact_units_relation, then computes
per-run cost from RunViewItem.pricing entries.
"""

from decimal import Decimal
from uuid import UUID

import asyncpg

from app.api.v4.entries.runs.types import RunViewItem
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached


async def _batch_fetch_pricing(
    conn: asyncpg.Connection,
    pricing_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, Decimal]:
    """Batch fetch pricing_resource prices by IDs."""
    if not pricing_ids:
        return {}

    cache_key_val = cache_key(
        "_shared/pricing/batch",
        {"ids": sorted(str(p) for p in pricing_ids)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return {UUID(k): Decimal(str(v)) for k, v in cached.items()}

    rows = await conn.fetch(
        "SELECT id, price FROM pricing_resource WHERE id = ANY($1) AND active = TRUE",
        pricing_ids,
    )
    result = {r["id"]: Decimal(str(r["price"])) for r in rows}

    await set_cached(
        cache_key_val,
        {str(k): str(v) for k, v in result.items()},
        ttl=300,
        tags=["_shared", "pricing"],
    )

    return result


async def _batch_fetch_units(
    conn: asyncpg.Connection,
    unit_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, Decimal]:
    """Batch fetch artifact_units_relation values by IDs."""
    if not unit_ids:
        return {}

    cache_key_val = cache_key(
        "_shared/units/batch",
        {"ids": sorted(str(u) for u in unit_ids)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return {UUID(k): Decimal(str(v)) for k, v in cached.items()}

    rows = await conn.fetch(
        "SELECT id, value FROM artifact_units_relation WHERE id = ANY($1) AND active = TRUE",
        unit_ids,
    )
    result = {r["id"]: Decimal(str(r["value"])) for r in rows}

    await set_cached(
        cache_key_val,
        {str(k): str(v) for k, v in result.items()},
        ttl=300,
        tags=["_shared", "units"],
    )

    return result


async def compute_costs_from_runs(
    conn: asyncpg.Connection,
    runs: list[RunViewItem],
    bypass_cache: bool = False,
) -> dict[UUID, Decimal]:
    """Compute per-run cost from RunViewItem.pricing data.

    Batch-fetches pricing_resource + artifact_units_relation,
    then computes cost = (count / unit_value) * price for each pricing entry.

    Returns: {run_id: total_cost}
    """
    if not runs:
        return {}

    # Collect all pricing_ids and unit_ids
    all_pricing_ids: set[UUID] = set()
    all_unit_ids: set[UUID] = set()
    for run in runs:
        for p in run.pricing:
            if p.pricing_id:
                all_pricing_ids.add(p.pricing_id)
            if p.unit_id:
                all_unit_ids.add(p.unit_id)

    # Batch fetch pricing and unit data
    pricing_map, unit_map = {}, {}
    if all_pricing_ids:
        pricing_map = await _batch_fetch_pricing(
            conn, list(all_pricing_ids), bypass_cache
        )
    if all_unit_ids:
        unit_map = await _batch_fetch_units(conn, list(all_unit_ids), bypass_cache)

    # Compute per-run cost
    result: dict[UUID, Decimal] = {}
    for run in runs:
        total_cost = Decimal("0")
        for p in run.pricing:
            if p.pricing_id and p.unit_id and p.count:
                price = pricing_map.get(p.pricing_id, Decimal("0"))
                unit_val = unit_map.get(p.unit_id, Decimal("1"))
                if unit_val > 0:
                    total_cost += (Decimal(str(p.count)) / unit_val) * price
        result[run.run_id] = total_cost

    return result

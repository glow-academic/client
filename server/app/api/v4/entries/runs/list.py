"""Run list entries endpoint."""

from datetime import datetime
from uuid import UUID

import asyncpg

from app.api.v4.entries.runs.types import (
    GetRunListViewResponse,
    RunPricingItem,
    RunViewItem,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/run/list/get_run_list_view_complete.sql"


def _build_pricing_list(item: object) -> list[RunPricingItem]:
    """Build pricing list from flat columns."""
    pricing: list[RunPricingItem] = []
    if getattr(item, "input_pricing_count", None) is not None:
        pricing.append(
            RunPricingItem(
                pricing_type="input",
                count=item.input_pricing_count or 0,
                unit_id=item.input_pricing_unit_id,
                pricing_id=item.input_pricing_pricing_id,
            )
        )
    if getattr(item, "output_pricing_count", None) is not None:
        pricing.append(
            RunPricingItem(
                pricing_type="output",
                count=item.output_pricing_count or 0,
                unit_id=item.output_pricing_unit_id,
                pricing_id=item.output_pricing_pricing_id,
            )
        )
    if getattr(item, "cached_pricing_count", None) is not None:
        pricing.append(
            RunPricingItem(
                pricing_type="cached",
                count=item.cached_pricing_count or 0,
                unit_id=item.cached_pricing_unit_id,
                pricing_id=item.cached_pricing_pricing_id,
            )
        )
    return pricing


async def get_run_list_entries_internal(
    conn: asyncpg.Connection,
    group_id_filter: UUID | None = None,
    group_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
    profile_id_filter: UUID | None = None,
) -> GetRunListViewResponse:
    """Internal function for fetching run data from runs_mv."""
    from app.sql.types import GetRunListViewSqlParams

    cache_key_val = cache_key(
        "entries/run/list/get",
        {
            "group_id_filter": str(group_id_filter) if group_id_filter else None,
            "group_ids": [str(g) for g in group_ids] if group_ids else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
            "profile_id_filter": str(profile_id_filter)
            if profile_id_filter
            else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetRunListViewResponse.model_validate(cached)

    params = GetRunListViewSqlParams(
        group_id_filter=group_id_filter,
        group_ids=group_ids,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
        profile_id_filter=profile_id_filter,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[RunViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                RunViewItem(
                    run_id=item.run_id,
                    group_id=item.group_id,
                    input_tokens=item.input_tokens or 0,
                    output_tokens=item.output_tokens or 0,
                    cached_input_tokens=item.cached_input_tokens or 0,
                    run_created_at=item.run_created_at,
                    agent_ids=list(item.agent_ids) if item.agent_ids else None,
                    model_ids=list(item.model_ids) if item.model_ids else None,
                    provider_ids=list(item.provider_ids)
                    if item.provider_ids
                    else None,
                    pricing=_build_pricing_list(item),
                )
            )

    response = GetRunListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "run", "list"],
    )

    return response

"""Get endpoint for run list view."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.run.list.types import (
    GetRunListViewResponse,
    RunPricingItem,
    RunViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/run/list/get_run_list_view_complete.sql"

router = APIRouter()


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


async def get_run_list_view_internal(
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
) -> GetRunListViewResponse:
    """Internal function for fetching run data from mv_runs."""
    from app.sql.types import GetRunListViewSqlParams

    cache_key_val = cache_key(
        "views/run/list/get",
        {
            "group_id_filter": str(group_id_filter) if group_id_filter else None,
            "group_ids": [str(g) for g in group_ids] if group_ids else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
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
                    provider_ids=list(item.provider_ids) if item.provider_ids else None,
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
        tags=["views", "run", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetRunListViewResponse,
    dependencies=[
        audit_activity(
            "views.run.list.get",
            "{{ actor.name }} fetched run list data",
        )
    ],
)
async def get_runs(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRunListViewResponse:
    """Get run data from the materialized view."""
    tags = ["views", "run", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_run_list_view_internal(
            conn=conn,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_run_list_get",
            request=http_request,
        )

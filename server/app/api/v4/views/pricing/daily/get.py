"""Get endpoint for pricing daily view (mv_pricing_daily)."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.pricing.daily.types import (
    PricingDailyItem,
    GetPricingDailyRequest,
    GetPricingDailyResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_pricing_daily_internal(
    conn: asyncpg.Connection,
    model_id: UUID | None = None,
    agent_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    cohort_ids: list[UUID] | None = None,  # Not used - MV doesn't have profile-level data
    department_ids: list[UUID] | None = None,  # Not used - MV doesn't have profile-level data
    roles: list[str] | None = None,  # Not used - MV doesn't have profile-level data
    page_limit: int = 30,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetPricingDailyResponse:
    """Internal function for fetching pricing daily data."""
    cache_key_val = cache_key(
        "views/pricing/daily/get",
        {
            "model_id": str(model_id) if model_id else None,
            "agent_id": str(agent_id) if agent_id else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetPricingDailyResponse.model_validate(cached)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if model_id:
        conditions.append(f"model_id = ${param_idx}")
        params.append(model_id)
        param_idx += 1

    if agent_id:
        conditions.append(f"agent_id = ${param_idx}")
        params.append(agent_id)
        param_idx += 1

    if date_from:
        conditions.append(f"date_key >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"date_key <= ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    count_query = f"SELECT COUNT(*) FROM mv_pricing_daily WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    data_query = f"""
        SELECT *
        FROM mv_pricing_daily
        WHERE {where_clause}
        ORDER BY date_key DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        PricingDailyItem(
            date_key=row["date_key"],
            model_id=row["model_id"],
            agent_id=row["agent_id"],
            run_count=row["run_count"] or 0,
            group_count=row["group_count"] or 0,
            unique_profiles=row["unique_profiles"] or 0,
            unique_sessions=row["unique_sessions"] or 0,
            total_input_tokens=row["total_input_tokens"] or 0,
            total_output_tokens=row["total_output_tokens"] or 0,
            total_cached_tokens=row["total_cached_tokens"] or 0,
            total_tokens=row["total_tokens"] or 0,
            total_input_cost=Decimal(str(row["total_input_cost"])) if row["total_input_cost"] else Decimal("0"),
            total_output_cost=Decimal(str(row["total_output_cost"])) if row["total_output_cost"] else Decimal("0"),
            total_cached_cost=Decimal(str(row["total_cached_cost"])) if row["total_cached_cost"] else Decimal("0"),
            total_cost=Decimal(str(row["total_cost"])) if row["total_cost"] else Decimal("0"),
            avg_tokens_per_run=float(row["avg_tokens_per_run"]) if row["avg_tokens_per_run"] else 0.0,
            avg_cost_per_run=Decimal(str(row["avg_cost_per_run"])) if row["avg_cost_per_run"] else Decimal("0"),
        )
        for row in rows
    ]

    response = GetPricingDailyResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "pricing", "daily"],
    )

    return response


@router.post(
    "/get",
    response_model=GetPricingDailyResponse,
    dependencies=[
        audit_activity(
            "views.pricing.daily.get",
            "{{ actor.name }} fetched pricing daily data",
        )
    ],
)
async def get_pricing_daily(
    request: GetPricingDailyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPricingDailyResponse:
    """Get pricing daily data from mv_pricing_daily."""
    tags = ["views", "pricing", "daily"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_pricing_daily_internal(
            conn=conn,
            model_id=request.model_id,
            agent_id=request.agent_id,
            date_from=request.date_from,
            date_to=request.date_to,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
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
            operation="views_pricing_daily_get",
            request=http_request,
        )

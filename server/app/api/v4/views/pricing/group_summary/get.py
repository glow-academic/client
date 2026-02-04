"""Get endpoint for pricing group summary view (mv_pricing_group_summary)."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.pricing.group_summary.types import (
    PricingGroupSummaryItem,
    GetPricingGroupSummaryRequest,
    GetPricingGroupSummaryResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_pricing_group_summary_internal(
    conn: asyncpg.Connection,
    session_id: UUID | None = None,
    profile_id: UUID | None = None,
    agent_id: UUID | None = None,
    model_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetPricingGroupSummaryResponse:
    """Internal function for fetching pricing group summary data."""
    cache_key_val = cache_key(
        "views/pricing/group_summary/get",
        {
            "session_id": str(session_id) if session_id else None,
            "profile_id": str(profile_id) if profile_id else None,
            "agent_id": str(agent_id) if agent_id else None,
            "model_id": str(model_id) if model_id else None,
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
            return GetPricingGroupSummaryResponse.model_validate(cached)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if session_id:
        conditions.append(f"session_id = ${param_idx}")
        params.append(session_id)
        param_idx += 1

    if profile_id:
        conditions.append(f"profile_id = ${param_idx}")
        params.append(profile_id)
        param_idx += 1

    if agent_id:
        conditions.append(f"${param_idx} = ANY(agent_ids)")
        params.append(agent_id)
        param_idx += 1

    if model_id:
        conditions.append(f"${param_idx} = ANY(model_ids)")
        params.append(model_id)
        param_idx += 1

    if date_from:
        conditions.append(f"last_run_at >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"last_run_at < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    sort_column = {
        "date": "last_run_at",
        "cost": "total_cost",
        "tokens": "total_tokens",
        "runs": "run_count",
    }.get(sort_by, "last_run_at")

    order_dir = "DESC" if sort_order == "desc" else "ASC"

    count_query = f"SELECT COUNT(*) FROM mv_pricing_group_summary WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    data_query = f"""
        SELECT *
        FROM mv_pricing_group_summary
        WHERE {where_clause}
        ORDER BY {sort_column} {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        PricingGroupSummaryItem(
            group_id=row["group_id"],
            session_id=row["session_id"],
            profile_id=row["profile_id"],
            primary_agent_id=row["primary_agent_id"],
            primary_model_id=row["primary_model_id"],
            first_run_at=row["first_run_at"],
            last_run_at=row["last_run_at"],
            run_count=row["run_count"] or 0,
            unique_agents=row["unique_agents"] or 0,
            unique_models=row["unique_models"] or 0,
            total_input_tokens=row["total_input_tokens"] or 0,
            total_output_tokens=row["total_output_tokens"] or 0,
            total_cached_tokens=row["total_cached_tokens"] or 0,
            total_tokens=row["total_tokens"] or 0,
            total_input_cost=Decimal(str(row["total_input_cost"])) if row["total_input_cost"] else Decimal("0"),
            total_output_cost=Decimal(str(row["total_output_cost"])) if row["total_output_cost"] else Decimal("0"),
            total_cached_cost=Decimal(str(row["total_cached_cost"])) if row["total_cached_cost"] else Decimal("0"),
            total_cost=Decimal(str(row["total_cost"])) if row["total_cost"] else Decimal("0"),
            group_name=row["group_name"],
            trace_id=row["trace_id"],
            agent_ids=row["agent_ids"],
            model_ids=row["model_ids"],
        )
        for row in rows
    ]

    response = GetPricingGroupSummaryResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "pricing", "group_summary"],
    )

    return response


@router.post(
    "/get",
    response_model=GetPricingGroupSummaryResponse,
    dependencies=[
        audit_activity(
            "views.pricing.group_summary.get",
            "{{ actor.name }} fetched pricing group summary data",
        )
    ],
)
async def get_pricing_group_summary(
    request: GetPricingGroupSummaryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPricingGroupSummaryResponse:
    """Get pricing group summary data from mv_pricing_group_summary."""
    tags = ["views", "pricing", "group_summary"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_pricing_group_summary_internal(
            conn=conn,
            session_id=request.session_id,
            profile_id=request.profile_id,
            agent_id=request.agent_id,
            model_id=request.model_id,
            date_from=request.date_from,
            date_to=request.date_to,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
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
            operation="views_pricing_group_summary_get",
            request=http_request,
        )

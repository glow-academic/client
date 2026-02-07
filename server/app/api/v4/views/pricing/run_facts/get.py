"""Get endpoint for pricing run facts view (mv_pricing_run_facts)."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.pricing.run_facts.types import (
    GetPricingRunFactsRequest,
    GetPricingRunFactsResponse,
    PricingRunFactsItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_pricing_run_facts_internal(
    conn: asyncpg.Connection,
    group_id: UUID | None = None,
    agent_id: UUID | None = None,
    model_id: UUID | None = None,
    profile_id: UUID | None = None,
    session_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetPricingRunFactsResponse:
    """Internal function for fetching pricing run facts data.

    Args:
        conn: Database connection
        group_id: Filter by group ID
        agent_id: Filter by agent ID
        model_id: Filter by model ID
        profile_id: Filter by profile ID
        session_id: Filter by session ID
        date_from: Filter by date range start
        date_to: Filter by date range end
        sort_by: Sort field ('date' | 'cost' | 'tokens')
        sort_order: Sort order ('asc' | 'desc')
        page_limit: Items per page
        page_offset: Pagination offset
        bypass_cache: Skip cache lookup

    Returns:
        GetPricingRunFactsResponse with items and total_count
    """
    cache_key_val = cache_key(
        "views/pricing/run_facts/get",
        {
            "group_id": str(group_id) if group_id else None,
            "agent_id": str(agent_id) if agent_id else None,
            "model_id": str(model_id) if model_id else None,
            "profile_id": str(profile_id) if profile_id else None,
            "session_id": str(session_id) if session_id else None,
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
            return GetPricingRunFactsResponse.model_validate(cached)

    # Build query dynamically
    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if group_id:
        conditions.append(f"group_id = ${param_idx}")
        params.append(group_id)
        param_idx += 1

    if agent_id:
        conditions.append(f"agent_id = ${param_idx}")
        params.append(agent_id)
        param_idx += 1

    if model_id:
        conditions.append(f"model_id = ${param_idx}")
        params.append(model_id)
        param_idx += 1

    if profile_id:
        conditions.append(f"profile_id = ${param_idx}")
        params.append(profile_id)
        param_idx += 1

    if session_id:
        conditions.append(f"session_id = ${param_idx}")
        params.append(session_id)
        param_idx += 1

    if date_from:
        conditions.append(f"run_created_at >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"run_created_at < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    # Sort mapping
    sort_column = {
        "date": "run_created_at",
        "cost": "total_cost",
        "tokens": "total_tokens",
    }.get(sort_by, "run_created_at")

    order_dir = "DESC" if sort_order == "desc" else "ASC"

    # Count query
    count_query = f"SELECT COUNT(*) FROM mv_pricing_run_facts WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    # Data query
    data_query = f"""
        SELECT
            run_id, group_id, agent_id, model_id, profile_id, session_id,
            input_tokens, output_tokens, cached_input_tokens, total_tokens,
            input_cost, output_cost, cached_cost, total_cost,
            run_created_at, group_name, trace_id
        FROM mv_pricing_run_facts
        WHERE {where_clause}
        ORDER BY {sort_column} {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        PricingRunFactsItem(
            run_id=row["run_id"],
            group_id=row["group_id"],
            agent_id=row["agent_id"],
            model_id=row["model_id"],
            profile_id=row["profile_id"],
            session_id=row["session_id"],
            input_tokens=row["input_tokens"] or 0,
            output_tokens=row["output_tokens"] or 0,
            cached_input_tokens=row["cached_input_tokens"] or 0,
            total_tokens=row["total_tokens"] or 0,
            input_cost=Decimal(str(row["input_cost"]))
            if row["input_cost"]
            else Decimal("0"),
            output_cost=Decimal(str(row["output_cost"]))
            if row["output_cost"]
            else Decimal("0"),
            cached_cost=Decimal(str(row["cached_cost"]))
            if row["cached_cost"]
            else Decimal("0"),
            total_cost=Decimal(str(row["total_cost"]))
            if row["total_cost"]
            else Decimal("0"),
            run_created_at=row["run_created_at"],
            group_name=row["group_name"],
            trace_id=row["trace_id"],
        )
        for row in rows
    ]

    response = GetPricingRunFactsResponse(
        items=items,
        total_count=total_count or 0,
    )

    # Cache the result
    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "pricing", "run_facts"],
    )

    return response


@router.post(
    "/get",
    response_model=GetPricingRunFactsResponse,
    dependencies=[
        audit_activity(
            "views.pricing.run_facts.get",
            "{{ actor.name }} fetched pricing run facts data",
        )
    ],
)
async def get_pricing_run_facts(
    request: GetPricingRunFactsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPricingRunFactsResponse:
    """Get pricing run facts data from mv_pricing_run_facts."""
    tags = ["views", "pricing", "run_facts"]

    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_pricing_run_facts_internal(
            conn=conn,
            group_id=request.group_id,
            agent_id=request.agent_id,
            model_id=request.model_id,
            profile_id=request.profile_id,
            session_id=request.session_id,
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
            operation="views_pricing_run_facts_get",
            request=http_request,
        )

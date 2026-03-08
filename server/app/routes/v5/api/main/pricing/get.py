"""Get endpoint for pricing artifact — top chart (daily cost aggregation)."""

from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_pool, get_redis_client
from app.infra.pricing_context import resolve_pricing_context
from app.routes.v5.api.main.pricing.types import (
    PricingDailyItem,
    PricingRequest,
    PricingResources,
    PricingResponse,
)
from app.routes.v5.api.main.types import FilterOption
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_run_costs(
    runs: list,
    pricing_map: dict[UUID, dict],
) -> dict[UUID, Decimal]:
    """Compute per-run cost from inline pricing entries + pricing_resource data.

    pricing_map: {pricing_id: {"price": Decimal, "unit_value": int}}
    """
    result: dict[UUID, Decimal] = {}
    for run in runs:
        total_cost = Decimal("0")
        for p in run.pricing:
            if p.pricing_id and p.count:
                info = pricing_map.get(p.pricing_id)
                if info and info["unit_value"] > 0:
                    total_cost += (
                        Decimal(str(p.count)) / Decimal(str(info["unit_value"]))
                    ) * info["price"]
        result[run.run_id] = total_cost
    return result


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=PricingResponse)
async def get_pricing(
    request: PricingRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingResponse:
    """Get pricing top chart — daily cost aggregation + filter options."""
    tags = ["artifacts", "pricing"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    cache_key_val = cache_key(
        http_request.url.path,
        request.model_dump(mode="json"),
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return PricingResponse.model_validate(cached["data"])

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        # --- Phase 0: Resolve common context (profile identity) ---
        async with pool.acquire() as c:
            common = await resolve_common_context(
                c, redis, profile_id=profile_id, bypass_cache=bypass_cache
            )
        if not common:
            raise HTTPException(status_code=401, detail="Profile not found")

        # --- Phase 1: Resolve pricing context ---
        async with pool.acquire() as c:
            ctx = await resolve_pricing_context(
                c,
                redis,
                date_from=request.effective_date_from,
                date_to=request.effective_date_to,
                bypass_cache=bypass_cache,
            )

        # --- Phase 2: Extract data ---
        runs = ctx.entries.get("runs", [])

        agents_rp = ctx.resources.get("agents")
        agent_list = agents_rp.selected if agents_rp else []
        models_rp = ctx.resources.get("models")
        model_list = models_rp.selected if models_rp else []
        pricing_rp = ctx.resources.get("pricing")
        pricing_list = pricing_rp.selected if pricing_rp else []

        # --- Phase 3: Build pricing map + compute costs ---
        pricing_map: dict[UUID, dict] = {}
        for p in pricing_list:
            if p.id:
                pricing_map[p.id] = {
                    "price": Decimal(str(p.price))
                    if p.price is not None
                    else Decimal("0"),
                    "unit_value": p.unit_value or 1,
                }

        run_costs = _compute_run_costs(runs, pricing_map)

        # --- Phase 4: Aggregate into daily buckets by (date, model_id) ---
        daily_buckets: dict[tuple[str, str | None], dict] = {}
        for run in runs:
            date_key = (
                run.run_created_at.strftime("%Y-%m-%d")
                if run.run_created_at
                else "unknown"
            )
            model_id = str(run.model_ids[0]) if run.model_ids else None
            bucket_key = (date_key, model_id)
            if bucket_key not in daily_buckets:
                daily_buckets[bucket_key] = {
                    "total_cost": Decimal("0"),
                    "run_count": 0,
                }
            daily_buckets[bucket_key]["total_cost"] += run_costs.get(
                run.run_id, Decimal("0")
            )
            daily_buckets[bucket_key]["run_count"] += 1

        daily_items = [
            PricingDailyItem(
                date_key=dk,
                model_id=mid,
                total_cost=bucket["total_cost"],
                run_count=bucket["run_count"],
            )
            for (dk, mid), bucket in sorted(
                daily_buckets.items(), key=lambda x: (x[0][0], x[0][1] or "")
            )
        ]

        # --- Phase 5: Build resources + filter options ---
        agent_map = {str(a.id): {"name": a.name} for a in agent_list if a.id}
        model_map = {str(m.id): {"name": m.name} for m in model_list if m.id}

        model_options = [
            FilterOption(value=str(m.id), label=m.name) for m in model_list if m.id
        ]
        agent_options = [
            FilterOption(value=str(a.id), label=a.name) for a in agent_list if a.id
        ]

        api_response = PricingResponse(
            daily=daily_items,
            resources=PricingResources(agents=agent_map, models=model_map),
            total_count=len(runs),
            model_options=model_options,
            agent_options=agent_options,
        )

        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
            redis=redis,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_pricing_get",
            request=http_request,
        )

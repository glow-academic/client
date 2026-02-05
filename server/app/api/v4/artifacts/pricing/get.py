"""Get endpoint for pricing artifact."""

import asyncio
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.pricing.types import (
    PricingRequest,
    PricingResponse,
    PricingViews,
    PricingResources,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.views.pricing.group_summary.get import get_pricing_group_summary_internal
from app.api.v4.views.pricing.daily.get import get_pricing_daily_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/get",
    response_model=PricingResponse,
    dependencies=[
        audit_activity(
            "artifacts.pricing.get",
            "{{ actor.name }} fetched pricing artifact data",
        )
    ],
)
async def get_pricing(
    request: PricingRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingResponse:
    """Get pricing artifact data."""
    tags = ["artifacts", "pricing"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:
        # Parallel fetch from view internals
        async def fetch_group_summary():
            async with pool.acquire() as c:
                return await get_pricing_group_summary_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    model_id=request.model_id,
                    agent_id=request.agent_id,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        async def fetch_daily():
            async with pool.acquire() as c:
                return await get_pricing_daily_internal(
                    conn=c,
                    model_id=request.model_id,
                    agent_id=request.agent_id,
                    date_from=request.date_from.date() if request.date_from else None,
                    date_to=request.date_to.date() if request.date_to else None,
                    page_limit=30,
                    bypass_cache=bypass_cache,
                )

        group_summary_result, daily_result = await asyncio.gather(
            fetch_group_summary(),
            fetch_daily(),
        )

        # Collect resource IDs
        agent_ids: set[str] = set()
        model_ids: set[str] = set()
        profile_ids: set[str] = set()

        for item in group_summary_result.items:
            if item.primary_agent_id:
                agent_ids.add(str(item.primary_agent_id))
            if item.primary_model_id:
                model_ids.add(str(item.primary_model_id))
            if item.profile_id:
                profile_ids.add(str(item.profile_id))

        for item in daily_result.items:
            if item.agent_id:
                agent_ids.add(str(item.agent_id))
            if item.model_id:
                model_ids.add(str(item.model_id))

        views = PricingViews(
            group_summary=group_summary_result.items,
            daily=daily_result.items,
        )
        resources = PricingResources(
            agents={aid: {} for aid in agent_ids},
            models={mid: {} for mid in model_ids},
            profiles={pid: {} for pid in profile_ids},
        )

        model_options = [
            FilterOption(value=mid) for mid in sorted(model_ids)
        ]
        agent_options = [
            FilterOption(value=aid) for aid in sorted(agent_ids)
        ]

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return PricingResponse(
            views=views,
            resources=resources,
            total_count=group_summary_result.total_count,
            model_options=model_options,
            agent_options=agent_options,
        )

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

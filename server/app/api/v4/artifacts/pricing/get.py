"""Get endpoint for pricing artifact."""

import asyncio
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.pricing.types import (
    PricingRequest,
    PricingResponse,
    PricingViews,
    PricingResources,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.resources.names.get import get_names_internal
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
        # Use effective dates (supports both start_date/end_date and date_from/date_to)
        effective_date_from = request.effective_date_from
        effective_date_to = request.effective_date_to

        # Parallel fetch from view internals
        async def fetch_group_summary():
            async with pool.acquire() as c:
                return await get_pricing_group_summary_internal(
                    conn=c,
                    profile_id=request.profile_id,
                    model_id=request.model_id,
                    agent_id=request.agent_id,
                    date_from=effective_date_from,
                    date_to=effective_date_to,
                    cohort_ids=request.cohort_ids,
                    department_ids=request.department_ids,
                    roles=request.roles,
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
                    date_from=effective_date_from.date() if effective_date_from else None,
                    date_to=effective_date_to.date() if effective_date_to else None,
                    cohort_ids=request.cohort_ids,
                    department_ids=request.department_ids,
                    roles=request.roles,
                    page_limit=365,  # Get up to a year of daily data for chart
                    bypass_cache=bypass_cache,
                )

        group_summary_result, daily_result = await asyncio.gather(
            fetch_group_summary(),
            fetch_daily(),
        )

        # Collect artifact IDs and build artifact_id → name_id mappings
        agent_ids: set[str] = set()
        model_ids: set[str] = set()
        profile_ids: set[str] = set()
        all_name_ids: set[UUID] = set()
        model_artifact_to_name_id: dict[str, UUID] = {}
        agent_artifact_to_name_id: dict[str, UUID] = {}
        profile_artifact_to_name_id: dict[str, UUID] = {}

        for item in group_summary_result.items:
            if item.primary_agent_id:
                agent_ids.add(str(item.primary_agent_id))
                if item.primary_agent_name_id:
                    agent_artifact_to_name_id[str(item.primary_agent_id)] = item.primary_agent_name_id
                    all_name_ids.add(item.primary_agent_name_id)
            if item.primary_model_id:
                model_ids.add(str(item.primary_model_id))
                if item.primary_model_name_id:
                    model_artifact_to_name_id[str(item.primary_model_id)] = item.primary_model_name_id
                    all_name_ids.add(item.primary_model_name_id)
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
                if item.profile_name_id:
                    profile_artifact_to_name_id[str(item.profile_id)] = item.profile_name_id
                    all_name_ids.add(item.profile_name_id)
            # Collect from arrays for complete coverage
            if item.agent_name_ids:
                all_name_ids.update(item.agent_name_ids)
            if item.model_name_ids:
                all_name_ids.update(item.model_name_ids)

        for item in daily_result.items:
            if item.agent_id:
                agent_ids.add(str(item.agent_id))
                if item.agent_name_id:
                    agent_artifact_to_name_id[str(item.agent_id)] = item.agent_name_id
                    all_name_ids.add(item.agent_name_id)
            if item.model_id:
                model_ids.add(str(item.model_id))
                if item.model_name_id:
                    model_artifact_to_name_id[str(item.model_id)] = item.model_name_id
                    all_name_ids.add(item.model_name_id)

        # Hydrate names via get_names_internal (cached, lightweight)
        name_id_to_str: dict[UUID, str] = {}
        if all_name_ids:
            async with pool.acquire() as c:
                name_items = await get_names_internal(
                    c, list(all_name_ids), bypass_cache
                )
            for ni in name_items:
                if ni.id and ni.name:
                    name_id_to_str[ni.id] = ni.name

        # Build artifact_id → name_string maps
        def resolve_name(artifact_to_name: dict[str, UUID], artifact_id: str) -> str | None:
            name_id = artifact_to_name.get(artifact_id)
            return name_id_to_str.get(name_id) if name_id else None

        views = PricingViews(
            group_summary=group_summary_result.items,
            daily=daily_result.items,
        )
        resources = PricingResources(
            agents={
                aid: {"name": resolve_name(agent_artifact_to_name_id, aid)}
                for aid in agent_ids
            },
            models={
                mid: {"name": resolve_name(model_artifact_to_name_id, mid)}
                for mid in model_ids
            },
            profiles={
                pid: {"name": resolve_name(profile_artifact_to_name_id, pid)}
                for pid in profile_ids
            },
        )

        model_options = [
            FilterOption(
                value=mid,
                label=resolve_name(model_artifact_to_name_id, mid),
            )
            for mid in sorted(model_ids)
        ]
        agent_options = [
            FilterOption(
                value=aid,
                label=resolve_name(agent_artifact_to_name_id, aid),
            )
            for aid in sorted(agent_ids)
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

"""Get endpoint for pricing artifact."""

import asyncio
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.pricing.types import (
    PricingRequest,
    PricingResources,
    PricingResponse,
    PricingViews,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.entries.runs.search import get_run_list_entries_internal
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.models.get import get_models_internal
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
        effective_date_from = request.effective_date_from
        effective_date_to = request.effective_date_to

        # Step 1: Fetch runs from runs_mv
        async with pool.acquire() as c:
            runs_result = await get_run_list_entries_internal(
                conn=c,
                date_from=effective_date_from,
                date_to=effective_date_to,
                page_limit=request.page_limit,
                page_offset=request.page_offset,
                bypass_cache=bypass_cache,
            )

        # Step 2: Collect unique agent/model IDs from runs
        agent_ids_set: set[UUID] = set()
        model_ids_set: set[UUID] = set()

        for item in runs_result.items:
            if item.agent_ids:
                agent_ids_set.update(item.agent_ids)
            if item.model_ids:
                model_ids_set.update(item.model_ids)

        # Step 3: Batch hydrate agents + models in parallel
        async def fetch_agents():
            async with pool.acquire() as c:
                return await get_agents_internal(
                    c, list(agent_ids_set), bypass_cache=bypass_cache
                )

        async def fetch_models():
            async with pool.acquire() as c:
                return await get_models_internal(
                    c, list(model_ids_set), bypass_cache=bypass_cache
                )

        agents_list, models_list = await asyncio.gather(fetch_agents(), fetch_models())

        # Build resource maps
        agent_map = {str(a.id): {"name": a.name} for a in agents_list if a.id}
        model_map = {str(m.id): {"name": m.name} for m in models_list if m.id}

        # Build filter options
        model_options = [
            FilterOption(value=str(m.id), label=m.name) for m in models_list if m.id
        ]
        agent_options = [
            FilterOption(value=str(a.id), label=a.name) for a in agents_list if a.id
        ]

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return PricingResponse(
            views=PricingViews(runs=runs_result.items),
            resources=PricingResources(agents=agent_map, models=model_map),
            total_count=runs_result.total_count,
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

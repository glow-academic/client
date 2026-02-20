"""Get endpoint for pricing artifact."""

import asyncio
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.group.list import get_group_list_internal
from app.api.v4.artifacts.group.types import GetGroupListRequest, GetGroupListResponse
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


async def _fetch_group_history_data(
    pool: asyncpg.Pool,
    profile_id: UUID,
    request: PricingRequest,
    bypass_cache: bool,
) -> GetGroupListResponse:
    """Fetch group list history inline — adapted from group/list.py."""
    group_request = GetGroupListRequest(
        session_id=request.history_session_id,
        model_id=request.history_model_id,
        agent_id=request.history_agent_id,
        date_from=request.effective_date_from,
        date_to=request.effective_date_to,
        sort_by=request.history_sort_by,
        sort_order=request.history_sort_order,
        page_limit=request.history_page_size,
        page_offset=request.history_page * request.history_page_size,
    )
    async with pool.acquire() as conn:
        return await get_group_list_internal(
            conn=conn,
            profile_id=profile_id,
            request=group_request,
            bypass_cache=bypass_cache,
        )


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
        profile_id = http_request.state.profile_id
        effective_date_from = request.effective_date_from
        effective_date_to = request.effective_date_to

        # Step 1: Fetch runs from runs_mv (+ optional group history in parallel)
        async def fetch_runs():
            async with pool.acquire() as c:
                return await get_run_list_entries_internal(
                    conn=c,
                    date_from=effective_date_from,
                    date_to=effective_date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        parallel_tasks: list = [fetch_runs()]
        if request.history_enabled:
            parallel_tasks.append(
                _fetch_group_history_data(pool, profile_id, request, bypass_cache)
            )

        parallel_results = await asyncio.gather(*parallel_tasks)
        runs_result = parallel_results[0]
        history_data: GetGroupListResponse | None = (
            parallel_results[1] if request.history_enabled else None
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
            history=history_data,
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

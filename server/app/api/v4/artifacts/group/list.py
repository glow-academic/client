"""Group list endpoint - POST /artifacts/group/list.

Uses view internals only — no raw SQL in artifact layer.
Fetches from mv_groups, mv_runs via view layer, then aggregates in Python.
"""

from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts._shared.pricing import compute_costs_from_runs
from app.api.v4.artifacts.group.types import (
    GetGroupListRequest,
    GetGroupListResponse,
    GroupListItem,
)
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.views.group.list.get import get_group_list_view_internal
from app.api.v4.views.run.list.get import get_run_list_view_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_group_list_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    request: GetGroupListRequest,
    actor_name: str | None = None,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v4/artifacts/group/list",
) -> GetGroupListResponse:
    """Internal function for group list with resource hydration."""
    body = request.model_dump(mode="json")
    cache_key_val = cache_key(cache_key_path, body)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetGroupListResponse.model_validate(cached["data"])

    # Pass 1: Get paginated groups from mv_groups
    view_result = await get_group_list_view_internal(
        conn=conn,
        session_id_filter=request.session_id,
        date_from=request.date_from,
        date_to=request.date_to,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
        bypass_cache=bypass_cache,
    )

    group_ids = [item.group_id for item in view_result.items]

    if not group_ids:
        return GetGroupListResponse(
            actor_name=actor_name,
            items=[],
            total_count=view_result.total_count,
        )

    # Pass 2: Get all runs for these groups via view internal
    runs_result = await get_run_list_view_internal(
        conn=conn,
        group_ids=group_ids,
        page_limit=10000,
        bypass_cache=bypass_cache,
    )

    # Compute per-run costs
    run_costs = await compute_costs_from_runs(conn, runs_result.items, bypass_cache)

    # Aggregate run stats per group + collect all name IDs
    group_stats: dict[UUID, dict] = {}
    all_agent_ids: set[UUID] = set()
    all_model_ids: set[UUID] = set()
    all_profile_ids: set[UUID] = set()

    for run in runs_result.items:
        gid = run.group_id
        if not gid:
            continue
        if gid not in group_stats:
            group_stats[gid] = {
                "run_count": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_tokens": 0,
                "total_cost": Decimal("0"),
                "first_run_at": None,
                "last_run_at": None,
                "agent_ids": set(),
                "model_ids": set(),
            }
        stats = group_stats[gid]
        stats["run_count"] += 1
        stats["total_input_tokens"] += run.input_tokens
        stats["total_output_tokens"] += run.output_tokens
        stats["total_tokens"] += (
            run.input_tokens + run.output_tokens + run.cached_input_tokens
        )
        stats["total_cost"] += run_costs.get(run.run_id, Decimal("0"))
        if run.run_created_at:
            if (
                stats["first_run_at"] is None
                or run.run_created_at < stats["first_run_at"]
            ):
                stats["first_run_at"] = run.run_created_at
            if (
                stats["last_run_at"] is None
                or run.run_created_at > stats["last_run_at"]
            ):
                stats["last_run_at"] = run.run_created_at
        if run.agent_ids:
            stats["agent_ids"].update(run.agent_ids)
            all_agent_ids.update(run.agent_ids)
        if run.model_ids:
            stats["model_ids"].update(run.model_ids)
            all_model_ids.update(run.model_ids)

    # Collect all IDs for name hydration (agent, model, profile)
    # Profile IDs come from sessions via group→session mapping
    for view_item in view_result.items:
        # We don't have direct profile_id on groups, but session has it
        pass

    # Fetch names via resource layer
    all_name_ids = list(all_agent_ids | all_model_ids | all_profile_ids)
    name_items = (
        await get_names_internal(conn, all_name_ids, bypass_cache)
        if all_name_ids
        else []
    )
    name_map = {item.id: item.name for item in name_items if item.id and item.name}

    # Assemble items
    items = []
    for view_item in view_result.items:
        gid = view_item.group_id
        stats = group_stats.get(gid, {})

        agent_id_list = list(stats.get("agent_ids", set()))
        model_id_list = list(stats.get("model_ids", set()))
        a_names = [name_map[aid] for aid in agent_id_list if aid in name_map] or None
        m_names = [name_map[mid] for mid in model_id_list if mid in name_map] or None

        items.append(
            GroupListItem(
                group_id=gid,
                session_id=view_item.session_id,
                profile_id=None,
                group_name=view_item.group_name,
                trace_id=view_item.trace_id,
                first_run_at=stats.get("first_run_at"),
                last_run_at=stats.get("last_run_at"),
                run_count=stats.get("run_count", 0),
                unique_agents=len(agent_id_list),
                unique_models=len(model_id_list),
                total_input_tokens=stats.get("total_input_tokens", 0),
                total_output_tokens=stats.get("total_output_tokens", 0),
                total_tokens=stats.get("total_tokens", 0),
                total_cost=stats.get("total_cost", Decimal("0")),
                agent_ids=agent_id_list or None,
                model_ids=model_id_list or None,
                profile_name=None,
                agent_names=a_names,
                model_names=m_names,
            )
        )

    api_response = GetGroupListResponse(
        actor_name=actor_name,
        items=items,
        total_count=view_result.total_count,
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=["artifacts", "group", "list"],
    )

    return api_response


@router.post(
    "/list",
    response_model=GetGroupListResponse,
    dependencies=[
        audit_activity("artifacts.group.list", "{{ actor.name }} fetched group list")
    ],
)
async def list_groups(
    request: GetGroupListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupListResponse:
    """Get paginated group list with resource hydration."""
    tags = ["artifacts", "group", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Get actor name for audit via resource layer
        actor_name_items = await get_names_internal(conn, [profile_id], bypass_cache)
        actor_name = actor_name_items[0].name if actor_name_items else None

        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        result = await get_group_list_internal(
            conn=conn,
            profile_id=profile_id,
            request=request,
            actor_name=actor_name,
            bypass_cache=bypass_cache,
            cache_key_path=http_request.url.path,
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
            operation="artifacts_group_list",
            request=http_request,
        )

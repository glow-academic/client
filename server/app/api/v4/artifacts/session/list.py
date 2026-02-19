"""Session list endpoint - POST /artifacts/session/list.

Uses view internals only — no raw SQL in artifact layer.
Fetches from sessions_mv, groups_mv, audits_mv, runs_mv via view layer,
then aggregates in Python.
"""

import asyncio
from collections import defaultdict
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts._shared.pricing import compute_costs_from_runs
from app.api.v4.artifacts.activity.get import resolve_profile_ids_for_filters
from app.api.v4.artifacts.session.types import (
    GetSessionListRequest,
    GetSessionListResponse,
    SessionListItem,
)
from app.api.v4.entries.audits.view import get_audit_list_view_internal
from app.api.v4.entries.groups.view import get_group_list_view_internal
from app.api.v4.entries.runs.search import get_run_list_entries_internal
from app.api.v4.entries.sessions.get import get_session_list_view_internal
from app.api.v4.resources.names.get import get_names_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_session_list_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    request: GetSessionListRequest,
    actor_name: str | None = None,
    profile_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v4/artifacts/session/list",
) -> GetSessionListResponse:
    """Internal function for session list with resource hydration."""
    body = request.model_dump(mode="json")
    body["profile_id"] = str(profile_id)
    if profile_ids:
        body["profile_ids"] = [str(p) for p in profile_ids]
    cache_key_val = cache_key(cache_key_path, body)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetSessionListResponse.model_validate(cached["data"])

    # Pass 1: Get paginated sessions from sessions_mv
    view_result = await get_session_list_view_internal(
        conn=conn,
        profile_id_filter=profile_id if not profile_ids else None,
        profile_ids_filter=profile_ids,
        active_filter=request.active,
        date_from=request.date_from,
        date_to=request.date_to,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
        bypass_cache=bypass_cache,
    )

    session_ids = [item.session_id for item in view_result.items]

    if not session_ids:
        total_count = view_result.total_count
        page_limit = request.page_limit
        page_offset = request.page_offset
        page = page_offset // page_limit if page_limit else 0
        total_pages = (total_count + page_limit - 1) // page_limit if page_limit else 0
        return GetSessionListResponse(
            actor_name=actor_name,
            items=[],
            total_count=total_count,
            page=page,
            page_size=page_limit,
            total_pages=total_pages,
        )

    # Pass 2: Batch fetch groups, audits via view internals (with session_ids filter)
    all_profile_ids = list(
        {item.profile_id for item in view_result.items if item.profile_id}
    )

    groups_result, audits_result, profile_name_items = await asyncio.gather(
        get_group_list_view_internal(
            conn=conn,
            session_ids=session_ids,
            page_limit=10000,
            bypass_cache=bypass_cache,
        ),
        get_audit_list_view_internal(
            conn=conn,
            session_ids=session_ids,
            page_limit=10000,
            bypass_cache=bypass_cache,
        ),
        get_names_internal(conn, all_profile_ids, bypass_cache),
    )

    # Build profile name lookup
    profile_names = {
        item.id: item.name for item in profile_name_items if item.id and item.name
    }

    # Compute group counts per session
    group_counts: dict[UUID, int] = defaultdict(int)
    group_ids: list[UUID] = []
    for g in groups_result.items:
        if g.session_id:
            group_counts[g.session_id] += 1
            group_ids.append(g.group_id)

    # Compute audit stats per session
    audit_counts: dict[UUID, int] = defaultdict(int)
    error_counts: dict[UUID, int] = defaultdict(int)
    last_audit_at: dict[UUID, object] = {}
    for a in audits_result.items:
        if a.session_id:
            audit_counts[a.session_id] += 1
            if a.error:
                error_counts[a.session_id] += 1
            existing = last_audit_at.get(a.session_id)
            if a.audit_created_at and (
                existing is None or a.audit_created_at > existing
            ):
                last_audit_at[a.session_id] = a.audit_created_at

    # Fetch runs for these groups
    runs_result = await get_run_list_entries_internal(
        conn=conn,
        group_ids=group_ids if group_ids else None,
        page_limit=10000,
        bypass_cache=bypass_cache,
    )

    # Compute costs from runs
    run_costs = await compute_costs_from_runs(conn, runs_result.items, bypass_cache)

    # Build group_id → session_id mapping
    group_to_session: dict[UUID, UUID] = {}
    for g in groups_result.items:
        if g.session_id:
            group_to_session[g.group_id] = g.session_id

    # Aggregate run stats per session
    run_counts: dict[UUID, int] = defaultdict(int)
    total_tokens_map: dict[UUID, int] = defaultdict(int)
    total_cost_map: dict[UUID, Decimal] = defaultdict(Decimal)
    first_run_at: dict[UUID, object] = {}
    last_run_at: dict[UUID, object] = {}
    for run in runs_result.items:
        sid = group_to_session.get(run.group_id) if run.group_id else None
        if not sid:
            continue
        run_counts[sid] += 1
        total_tokens_map[sid] += (
            run.input_tokens + run.output_tokens + run.cached_input_tokens
        )
        total_cost_map[sid] += run_costs.get(run.run_id, Decimal("0"))
        if run.run_created_at:
            existing_first = first_run_at.get(sid)
            if existing_first is None or run.run_created_at < existing_first:
                first_run_at[sid] = run.run_created_at
            existing_last = last_run_at.get(sid)
            if existing_last is None or run.run_created_at > existing_last:
                last_run_at[sid] = run.run_created_at

    # Assemble items
    items = []
    for view_item in view_result.items:
        sid = view_item.session_id

        items.append(
            SessionListItem(
                session_id=sid,
                profile_id=view_item.profile_id,
                profile_name=profile_names.get(view_item.profile_id)
                if view_item.profile_id
                else None,
                session_created_at=view_item.session_created_at,
                active=view_item.active,
                group_count=group_counts.get(sid, 0),
                run_count=run_counts.get(sid, 0),
                first_run_at=first_run_at.get(sid),
                last_run_at=last_run_at.get(sid),
                total_tokens=total_tokens_map.get(sid, 0),
                total_cost=total_cost_map.get(sid, Decimal("0")),
                audit_count=audit_counts.get(sid, 0),
                last_audit_at=last_audit_at.get(sid),
                error_count=error_counts.get(sid, 0),
            )
        )

    total_count = view_result.total_count
    page_limit = request.page_limit
    page_offset = request.page_offset
    page = page_offset // page_limit if page_limit else 0
    total_pages = (total_count + page_limit - 1) // page_limit if page_limit else 0

    api_response = GetSessionListResponse(
        actor_name=actor_name,
        items=items,
        total_count=total_count,
        page=page,
        page_size=page_limit,
        total_pages=total_pages,
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=["artifacts", "session", "list"],
    )

    return api_response


@router.post(
    "/list",
    response_model=GetSessionListResponse,
    dependencies=[
        audit_activity(
            "artifacts.session.list", "{{ actor.name }} fetched session list"
        )
    ],
)
async def list_sessions(
    request: GetSessionListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSessionListResponse:
    """Get paginated session list with resource hydration."""
    tags = ["artifacts", "session", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Get actor name for audit
        actor_name_items = await get_names_internal(conn, [profile_id], bypass_cache)
        actor_name = actor_name_items[0].name if actor_name_items else None

        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Pre-resolve department/role filters to profile_ids
        filter_profile_ids: list[UUID] | None = None
        if request.department_ids or request.roles:
            filter_profile_ids = await resolve_profile_ids_for_filters(
                conn=conn,
                department_ids=request.department_ids or None,
                roles=request.roles or None,
            )

        result = await get_session_list_internal(
            conn=conn,
            profile_id=profile_id,
            request=request,
            actor_name=actor_name,
            profile_ids=filter_profile_ids,
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
            operation="artifacts_session_list",
            request=http_request,
        )

"""Session detail endpoint - POST /artifacts/session/get.

Uses view internals only — no raw SQL in artifact layer.
Fetches from mv_sessions, mv_groups, mv_audits, mv_runs via view layer,
then aggregates in Python.
"""

import asyncio
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts._shared.pricing import compute_costs_from_runs
from app.api.v4.artifacts.session.types import (
    GetSessionDetailRequest,
    GetSessionDetailResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.views.artifacts.session_detail.types import (
    ArtifactSessionAudit,
    ArtifactSessionGroup,
)
from app.api.v4.views.audit.list.get import get_audit_list_view_internal
from app.api.v4.views.group.list.get import get_group_list_view_internal
from app.api.v4.views.run.list.get import get_run_list_view_internal
from app.api.v4.views.session.list.get import get_session_list_view_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


@router.post(
    "/get",
    response_model=GetSessionDetailResponse,
    dependencies=[
        audit_activity(
            "artifacts.session.get", "{{ actor.name }} viewed session detail"
        )
    ],
)
async def get_session(
    request: GetSessionDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSessionDetailResponse:
    """Get session detail with paginated audits and groups."""
    tags = ["artifacts", "session"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
        else:
            actor_name = None

        # Check for cached response
        body_dict = request.model_dump(mode="json")
        body_dict["profile_id"] = str(profile_id)
        cache_key_val = cache_key(http_request.url.path, body_dict)

        if not bypass_cache:
            cached = await get_cached(cache_key_val)
            if cached:
                response.headers["X-Cache-Tags"] = ",".join(tags)
                response.headers["X-Cache-Hit"] = "1"
                return GetSessionDetailResponse.model_validate(cached["data"])

        # Verify session exists via lean MV
        session_view = await get_session_list_view_internal(
            conn=conn,
            session_ids=[request.session_id],
            bypass_cache=bypass_cache,
        )

        if not session_view.items:
            raise HTTPException(
                status_code=404,
                detail=f"Session not found: {request.session_id}",
            )

        session = session_view.items[0]

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Parallel fetch: groups and audits via view internals
        groups_result, audits_result = await asyncio.gather(
            get_group_list_view_internal(
                conn=conn,
                session_id_filter=request.session_id,
                page_limit=1000,
                bypass_cache=bypass_cache,
            ),
            get_audit_list_view_internal(
                conn=conn,
                session_id_filter=request.session_id,
                page_limit=request.audit_limit,
                page_offset=request.audit_offset,
                bypass_cache=bypass_cache,
            ),
        )

        # Fetch runs for groups
        group_ids = [g.group_id for g in groups_result.items]
        runs_result = await get_run_list_view_internal(
            conn=conn,
            group_ids=group_ids if group_ids else None,
            page_limit=10000,
            bypass_cache=bypass_cache,
        )

        # Compute per-run costs
        run_costs = await compute_costs_from_runs(conn, runs_result.items, bypass_cache)

        # Aggregate run stats per group
        group_run_aggs: dict[UUID, dict] = {}
        for run in runs_result.items:
            gid = run.group_id
            if not gid:
                continue
            if gid not in group_run_aggs:
                group_run_aggs[gid] = {
                    "run_count": 0,
                    "total_tokens": 0,
                    "total_cost": Decimal("0"),
                    "first_run_at": None,
                    "last_run_at": None,
                }
            agg = group_run_aggs[gid]
            agg["run_count"] += 1
            agg["total_tokens"] += (
                run.input_tokens + run.output_tokens + run.cached_input_tokens
            )
            agg["total_cost"] += run_costs.get(run.run_id, Decimal("0"))
            if run.run_created_at:
                if (
                    agg["first_run_at"] is None
                    or run.run_created_at < agg["first_run_at"]
                ):
                    agg["first_run_at"] = run.run_created_at
                if (
                    agg["last_run_at"] is None
                    or run.run_created_at > agg["last_run_at"]
                ):
                    agg["last_run_at"] = run.run_created_at

        # Build groups with run aggregates
        groups = []
        for g in groups_result.items:
            agg = group_run_aggs.get(g.group_id, {})
            groups.append(
                ArtifactSessionGroup(
                    group_id=g.group_id,
                    group_name=g.group_name,
                    trace_id=g.trace_id,
                    first_run_at=agg.get("first_run_at"),
                    last_run_at=agg.get("last_run_at"),
                    run_count=agg.get("run_count", 0),
                    total_tokens=agg.get("total_tokens", 0),
                    total_cost=agg.get("total_cost", Decimal("0")),
                )
            )

        # Build audits
        audits = [
            ArtifactSessionAudit(
                id=a.audit_id,
                created_at=a.audit_created_at,
                message=a.message,
                endpoint=a.endpoint,
                error=a.error,
            )
            for a in audits_result.items
        ]

        # Get profile name via resource layer
        profile_name = None
        if session.profile_id:
            name_items = await get_names_internal(
                conn, [session.profile_id], bypass_cache
            )
            if name_items:
                profile_name = name_items[0].name

        api_response = GetSessionDetailResponse(
            actor_name=actor_name,
            session_exists=True,
            session_id=session.session_id,
            profile_id=session.profile_id,
            profile_name=profile_name,
            session_created_at=session.session_created_at,
            active=session.active,
            audit_total_count=audits_result.total_count,
            audits=audits,
            groups=groups,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
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
            operation="artifacts_session_get",
            request=http_request,
        )

"""Session detail endpoint - POST /artifacts/session/get.

Uses lean views (mv_sessions, mv_groups, mv_audits, mv_runs) with
asyncio.gather for parallel fetching and Python aggregation.
"""

import asyncio
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.session.types import (
    GetSessionDetailRequest,
    GetSessionDetailResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.views.artifacts.session_detail.types import (
    ArtifactSessionAudit,
    ArtifactSessionGroup,
)
from app.api.v4.views.audit.list.get import get_audit_list_view_internal
from app.api.v4.views.group.list.get import get_group_list_view_internal
from app.api.v4.views.session.list.get import get_session_list_view_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def _compute_group_run_aggregates(
    conn: asyncpg.Connection,
    session_id: UUID,
) -> dict[UUID, dict]:
    """Compute per-group run aggregates (run_count, tokens, cost) from mv_runs."""
    rows = await conn.fetch(
        """
        SELECT
            r.group_id,
            COUNT(*)::int AS run_count,
            SUM(r.input_tokens + r.output_tokens + r.cached_input_tokens)::bigint AS total_tokens,
            MIN(r.run_created_at) AS first_run_at,
            MAX(r.run_created_at) AS last_run_at,
            ARRAY_AGG(r.input_pricing_pricing_id) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_pids,
            ARRAY_AGG(r.input_pricing_count) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_cnts,
            ARRAY_AGG(r.input_pricing_unit_id) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_uids,
            ARRAY_AGG(r.output_pricing_pricing_id) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_pids,
            ARRAY_AGG(r.output_pricing_count) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_cnts,
            ARRAY_AGG(r.output_pricing_unit_id) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_uids,
            ARRAY_AGG(r.cached_pricing_pricing_id) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_pids,
            ARRAY_AGG(r.cached_pricing_count) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_cnts,
            ARRAY_AGG(r.cached_pricing_unit_id) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_uids
        FROM mv_runs r
        JOIN mv_groups g ON g.group_id = r.group_id
        WHERE g.session_id = $1
        GROUP BY r.group_id
        """,
        session_id,
    )

    if not rows:
        return {}

    # Collect all pricing/unit IDs for batch fetch
    all_pricing_ids: set[UUID] = set()
    all_unit_ids: set[UUID] = set()
    for row in rows:
        for ids in [row["input_pids"], row["output_pids"], row["cached_pids"]]:
            if ids:
                all_pricing_ids.update(ids)
        for ids in [row["input_uids"], row["output_uids"], row["cached_uids"]]:
            if ids:
                all_unit_ids.update(ids)

    pricing_map: dict[UUID, Decimal] = {}
    unit_map: dict[UUID, Decimal] = {}

    if all_pricing_ids:
        p_rows = await conn.fetch(
            "SELECT id, price FROM pricing_resource WHERE id = ANY($1) AND active = TRUE",
            list(all_pricing_ids),
        )
        pricing_map = {r["id"]: Decimal(str(r["price"])) for r in p_rows}

    if all_unit_ids:
        u_rows = await conn.fetch(
            "SELECT id, value FROM artifact_units_relation WHERE id = ANY($1) AND active = TRUE",
            list(all_unit_ids),
        )
        unit_map = {r["id"]: Decimal(str(r["value"])) for r in u_rows}

    result: dict[UUID, dict] = {}
    for row in rows:
        total_cost = Decimal("0")
        for pids, cnts, uids in [
            (row["input_pids"], row["input_cnts"], row["input_uids"]),
            (row["output_pids"], row["output_cnts"], row["output_uids"]),
            (row["cached_pids"], row["cached_cnts"], row["cached_uids"]),
        ]:
            if pids and cnts and uids:
                for pid, cnt, uid in zip(pids, cnts, uids, strict=False):
                    price = pricing_map.get(pid, Decimal("0"))
                    unit_val = unit_map.get(uid, Decimal("1"))
                    if unit_val > 0:
                        total_cost += (Decimal(str(cnt)) / unit_val) * price

        result[row["group_id"]] = {
            "run_count": row["run_count"],
            "total_tokens": row["total_tokens"] or 0,
            "total_cost": total_cost,
            "first_run_at": row["first_run_at"],
            "last_run_at": row["last_run_at"],
        }

    return result


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

        # Parallel fetch: groups, audits, run aggregates
        groups_result, audits_result, run_aggregates = await asyncio.gather(
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
            _compute_group_run_aggregates(conn, request.session_id),
        )

        # Build groups with run aggregates
        groups = []
        for g in groups_result.items:
            agg = run_aggregates.get(g.group_id, {})
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

        # Get profile name
        profile_name_row = await conn.fetchval(
            """
            SELECT n.name FROM profile_names_junction pn
            JOIN names_resource n ON pn.name_id = n.id
            WHERE pn.profile_id = $1 LIMIT 1
            """,
            session.profile_id,
        )

        api_response = GetSessionDetailResponse(
            actor_name=actor_name,
            session_exists=True,
            session_id=session.session_id,
            profile_id=session.profile_id,
            profile_name=profile_name_row,
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

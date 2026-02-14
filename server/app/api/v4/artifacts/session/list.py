"""Session list endpoint - POST /artifacts/session/list.

Uses lean mv_sessions view + batch aggregation from mv_groups, mv_audits, mv_runs
to compute group_count, audit_count, error_count, run_count, total_tokens, total_cost.
"""

import asyncio
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.activity.get import resolve_profile_ids_for_filters
from app.api.v4.artifacts.session.types import (
    GetSessionListRequest,
    GetSessionListResponse,
    SessionListItem,
)
from app.api.v4.views.session.list.get import get_session_list_view_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def _batch_group_counts(
    conn: asyncpg.Connection, session_ids: list[UUID]
) -> dict[UUID, int]:
    """Get group count per session from mv_groups."""
    if not session_ids:
        return {}
    rows = await conn.fetch(
        "SELECT session_id, COUNT(*)::int AS cnt FROM mv_groups WHERE session_id = ANY($1) GROUP BY session_id",
        session_ids,
    )
    return {row["session_id"]: row["cnt"] for row in rows}


async def _batch_audit_stats(
    conn: asyncpg.Connection, session_ids: list[UUID]
) -> dict[UUID, dict]:
    """Get audit count, error count, last_audit_at per session from mv_audits."""
    if not session_ids:
        return {}
    rows = await conn.fetch(
        """
        SELECT
            session_id,
            COUNT(*)::int AS audit_count,
            COUNT(*) FILTER (WHERE error = TRUE)::int AS error_count,
            MAX(audit_created_at) AS last_audit_at
        FROM mv_audits
        WHERE session_id = ANY($1)
        GROUP BY session_id
        """,
        session_ids,
    )
    return {
        row["session_id"]: {
            "audit_count": row["audit_count"],
            "error_count": row["error_count"],
            "last_audit_at": row["last_audit_at"],
        }
        for row in rows
    }


async def _batch_run_stats(
    conn: asyncpg.Connection, session_ids: list[UUID]
) -> dict[UUID, dict]:
    """Get run_count, total_tokens, first/last run_at, total_cost per session.

    Joins mv_runs with mv_groups to get session_id, then batch-fetches
    pricing_resource and artifact_units_relation for cost computation.
    """
    if not session_ids:
        return {}

    # Get per-session run aggregates + pricing data
    rows = await conn.fetch(
        """
        SELECT
            g.session_id,
            COUNT(*)::int AS run_count,
            SUM(r.input_tokens + r.output_tokens + r.cached_input_tokens)::bigint AS total_tokens,
            MIN(r.run_created_at) AS first_run_at,
            MAX(r.run_created_at) AS last_run_at,
            -- Collect pricing IDs for cost computation
            ARRAY_AGG(r.input_pricing_pricing_id) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_pricing_ids,
            ARRAY_AGG(r.input_pricing_count) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_pricing_counts,
            ARRAY_AGG(r.input_pricing_unit_id) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_unit_ids,
            ARRAY_AGG(r.output_pricing_pricing_id) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_pricing_ids,
            ARRAY_AGG(r.output_pricing_count) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_pricing_counts,
            ARRAY_AGG(r.output_pricing_unit_id) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_unit_ids,
            ARRAY_AGG(r.cached_pricing_pricing_id) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_pricing_ids,
            ARRAY_AGG(r.cached_pricing_count) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_pricing_counts,
            ARRAY_AGG(r.cached_pricing_unit_id) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_unit_ids
        FROM mv_runs r
        JOIN mv_groups g ON g.group_id = r.group_id
        WHERE g.session_id = ANY($1)
        GROUP BY g.session_id
        """,
        session_ids,
    )

    if not rows:
        return {}

    # Collect all unique pricing_ids and unit_ids for batch fetch
    all_pricing_ids: set[UUID] = set()
    all_unit_ids: set[UUID] = set()
    for row in rows:
        for ids in [
            row["input_pricing_ids"],
            row["output_pricing_ids"],
            row["cached_pricing_ids"],
        ]:
            if ids:
                all_pricing_ids.update(ids)
        for ids in [
            row["input_unit_ids"],
            row["output_unit_ids"],
            row["cached_unit_ids"],
        ]:
            if ids:
                all_unit_ids.update(ids)

    # Batch fetch pricing and units
    pricing_map: dict[UUID, Decimal] = {}
    unit_map: dict[UUID, Decimal] = {}

    if all_pricing_ids:
        pricing_rows = await conn.fetch(
            "SELECT id, price FROM pricing_resource WHERE id = ANY($1) AND active = TRUE",
            list(all_pricing_ids),
        )
        pricing_map = {r["id"]: Decimal(str(r["price"])) for r in pricing_rows}

    if all_unit_ids:
        unit_rows = await conn.fetch(
            "SELECT id, value FROM artifact_units_relation WHERE id = ANY($1) AND active = TRUE",
            list(all_unit_ids),
        )
        unit_map = {r["id"]: Decimal(str(r["value"])) for r in unit_rows}

    # Compute total cost per session
    result: dict[UUID, dict] = {}
    for row in rows:
        total_cost = Decimal("0")
        for pricing_ids, counts, unit_ids in [
            (
                row["input_pricing_ids"],
                row["input_pricing_counts"],
                row["input_unit_ids"],
            ),
            (
                row["output_pricing_ids"],
                row["output_pricing_counts"],
                row["output_unit_ids"],
            ),
            (
                row["cached_pricing_ids"],
                row["cached_pricing_counts"],
                row["cached_unit_ids"],
            ),
        ]:
            if pricing_ids and counts and unit_ids:
                for pid, cnt, uid in zip(pricing_ids, counts, unit_ids, strict=False):
                    price = pricing_map.get(pid, Decimal("0"))
                    unit_val = unit_map.get(uid, Decimal("1"))
                    if unit_val > 0:
                        total_cost += (Decimal(str(cnt)) / unit_val) * price

        result[row["session_id"]] = {
            "run_count": row["run_count"],
            "total_tokens": row["total_tokens"] or 0,
            "first_run_at": row["first_run_at"],
            "last_run_at": row["last_run_at"],
            "total_cost": total_cost,
        }

    return result


async def _batch_profile_names(
    conn: asyncpg.Connection, profile_ids: list[UUID]
) -> dict[UUID, str]:
    """Get profile names via naming junction."""
    if not profile_ids:
        return {}
    rows = await conn.fetch(
        """
        SELECT pn.profile_id, n.name
        FROM profile_names_junction pn
        JOIN names_resource n ON pn.name_id = n.id
        WHERE pn.profile_id = ANY($1)
        """,
        profile_ids,
    )
    return {row["profile_id"]: row["name"] for row in rows if row["name"]}


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

    # Pass 1: Get paginated sessions from mv_sessions
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

    # Pass 2: Batch aggregation in parallel
    all_profile_ids = list(
        {item.profile_id for item in view_result.items if item.profile_id}
    )

    group_counts, audit_stats, run_stats, profile_names = await asyncio.gather(
        _batch_group_counts(conn, session_ids),
        _batch_audit_stats(conn, session_ids),
        _batch_run_stats(conn, session_ids),
        _batch_profile_names(conn, all_profile_ids),
    )

    # Assemble items
    items = []
    for view_item in view_result.items:
        sid = view_item.session_id
        audit = audit_stats.get(sid, {})
        runs = run_stats.get(sid, {})

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
                run_count=runs.get("run_count", 0),
                first_run_at=runs.get("first_run_at"),
                last_run_at=runs.get("last_run_at"),
                total_tokens=runs.get("total_tokens", 0),
                total_cost=runs.get("total_cost", Decimal("0")),
                audit_count=audit.get("audit_count", 0),
                last_audit_at=audit.get("last_audit_at"),
                error_count=audit.get("error_count", 0),
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
        actor_name = await conn.fetchval(
            """
            SELECT n.name
            FROM profile_names_junction pn
            JOIN names_resource n ON pn.name_id = n.id
            WHERE pn.profile_id = $1
            LIMIT 1
            """,
            profile_id,
        )

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

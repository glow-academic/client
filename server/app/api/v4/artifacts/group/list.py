"""Group list endpoint - POST /artifacts/group/list.

Uses lean views (mv_groups, mv_runs) with asyncio.gather for parallel
fetching and Python aggregation.
"""

import asyncio
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.group.types import (
    GetGroupListRequest,
    GetGroupListResponse,
    GroupListItem,
)
from app.api.v4.views.group.list.get import get_group_list_view_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def _fetch_names_by_ids(
    conn: asyncpg.Connection,
    table: str,
    id_column: str,
    name_junction: str,
    ids: list[UUID],
) -> dict[UUID, str]:
    """Fetch names for artifact IDs via naming junction tables."""
    if not ids:
        return {}
    rows = await conn.fetch(
        f"""
        SELECT a.id, n.name
        FROM {table} a
        JOIN {name_junction} an ON an.{id_column} = a.id
        JOIN names_resource n ON an.name_id = n.id
        WHERE a.id = ANY($1)
        """,
        ids,
    )
    return {row["id"]: row["name"] for row in rows if row["name"]}


async def _batch_run_stats_for_groups(
    conn: asyncpg.Connection, group_ids: list[UUID]
) -> dict[UUID, dict]:
    """Get per-group run aggregates from mv_runs.

    Returns run_count, tokens, cost, first/last_run_at, agent_ids, model_ids per group.
    """
    if not group_ids:
        return {}

    rows = await conn.fetch(
        """
        SELECT
            r.group_id,
            COUNT(*)::int AS run_count,
            SUM(r.input_tokens)::bigint AS total_input_tokens,
            SUM(r.output_tokens)::bigint AS total_output_tokens,
            SUM(r.input_tokens + r.output_tokens + r.cached_input_tokens)::bigint AS total_tokens,
            MIN(r.run_created_at) AS first_run_at,
            MAX(r.run_created_at) AS last_run_at,
            -- Collect distinct agent/model IDs across all runs in this group
            ARRAY_AGG(DISTINCT aid) FILTER (WHERE aid IS NOT NULL) AS agent_ids,
            ARRAY_AGG(DISTINCT mid) FILTER (WHERE mid IS NOT NULL) AS model_ids,
            -- Pricing data for cost computation
            ARRAY_AGG(r.input_pricing_pricing_id) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_pids,
            ARRAY_AGG(r.input_pricing_count) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_cnts,
            ARRAY_AGG(r.input_pricing_unit_id) FILTER (WHERE r.input_pricing_pricing_id IS NOT NULL) AS input_uids,
            ARRAY_AGG(r.output_pricing_pricing_id) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_pids,
            ARRAY_AGG(r.output_pricing_count) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_cnts,
            ARRAY_AGG(r.output_pricing_unit_id) FILTER (WHERE r.output_pricing_pricing_id IS NOT NULL) AS output_uids,
            ARRAY_AGG(r.cached_pricing_pricing_id) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_pids,
            ARRAY_AGG(r.cached_pricing_count) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_cnts,
            ARRAY_AGG(r.cached_pricing_unit_id) FILTER (WHERE r.cached_pricing_pricing_id IS NOT NULL) AS cached_uids
        FROM mv_runs r,
        LATERAL UNNEST(COALESCE(r.agent_ids, ARRAY[]::uuid[])) AS aid,
        LATERAL UNNEST(COALESCE(r.model_ids, ARRAY[]::uuid[])) AS mid
        WHERE r.group_id = ANY($1)
        GROUP BY r.group_id
        """,
        group_ids,
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

        agent_ids_list = list(row["agent_ids"]) if row["agent_ids"] else []
        model_ids_list = list(row["model_ids"]) if row["model_ids"] else []

        result[row["group_id"]] = {
            "run_count": row["run_count"],
            "total_input_tokens": row["total_input_tokens"] or 0,
            "total_output_tokens": row["total_output_tokens"] or 0,
            "total_tokens": row["total_tokens"] or 0,
            "total_cost": total_cost,
            "first_run_at": row["first_run_at"],
            "last_run_at": row["last_run_at"],
            "agent_ids": agent_ids_list,
            "model_ids": model_ids_list,
            "unique_agents": len(agent_ids_list),
            "unique_models": len(model_ids_list),
        }

    return result


async def _batch_profile_ids_for_groups(
    conn: asyncpg.Connection, group_ids: list[UUID]
) -> dict[UUID, UUID]:
    """Get profile_id per group via profiles_runs_connection + runs."""
    if not group_ids:
        return {}
    rows = await conn.fetch(
        """
        SELECT DISTINCT ON (r.group_id) r.group_id, prc.profile_id
        FROM mv_runs r
        JOIN profiles_runs_connection prc ON prc.run_id = r.run_id AND prc.active = TRUE
        WHERE r.group_id = ANY($1)
        ORDER BY r.group_id, r.run_created_at DESC
        """,
        group_ids,
    )
    return {row["group_id"]: row["profile_id"] for row in rows}


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

    # Pass 2: Batch aggregation in parallel
    run_stats, profile_map = await asyncio.gather(
        _batch_run_stats_for_groups(conn, group_ids),
        _batch_profile_ids_for_groups(conn, group_ids),
    )

    # Collect all IDs for name hydration
    all_agent_ids: set[UUID] = set()
    all_model_ids: set[UUID] = set()
    all_profile_ids: set[UUID] = set()
    for gid in group_ids:
        stats = run_stats.get(gid, {})
        all_agent_ids.update(stats.get("agent_ids", []))
        all_model_ids.update(stats.get("model_ids", []))
        pid = profile_map.get(gid)
        if pid:
            all_profile_ids.add(pid)

    # Fetch names via junction tables
    agent_names, model_names, profile_names = await asyncio.gather(
        _fetch_names_by_ids(
            conn,
            "agent_artifact",
            "agent_id",
            "agent_names_junction",
            list(all_agent_ids),
        ),
        _fetch_names_by_ids(
            conn,
            "model_artifact",
            "model_id",
            "model_names_junction",
            list(all_model_ids),
        ),
        _fetch_names_by_ids(
            conn,
            "profile_artifact",
            "profile_id",
            "profile_names_junction",
            list(all_profile_ids),
        ),
    )

    # Assemble items
    items = []
    for view_item in view_result.items:
        gid = view_item.group_id
        stats = run_stats.get(gid, {})
        pid = profile_map.get(gid)

        agent_id_list = stats.get("agent_ids", [])
        model_id_list = stats.get("model_ids", [])
        a_names = [
            agent_names[aid] for aid in agent_id_list if aid in agent_names
        ] or None
        m_names = [
            model_names[mid] for mid in model_id_list if mid in model_names
        ] or None

        items.append(
            GroupListItem(
                group_id=gid,
                session_id=view_item.session_id,
                profile_id=pid,
                group_name=view_item.group_name,
                trace_id=view_item.trace_id,
                first_run_at=stats.get("first_run_at"),
                last_run_at=stats.get("last_run_at"),
                run_count=stats.get("run_count", 0),
                unique_agents=stats.get("unique_agents", 0),
                unique_models=stats.get("unique_models", 0),
                total_input_tokens=stats.get("total_input_tokens", 0),
                total_output_tokens=stats.get("total_output_tokens", 0),
                total_tokens=stats.get("total_tokens", 0),
                total_cost=stats.get("total_cost", Decimal("0")),
                agent_ids=agent_id_list or None,
                model_ids=model_id_list or None,
                profile_name=profile_names.get(pid) if pid else None,
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

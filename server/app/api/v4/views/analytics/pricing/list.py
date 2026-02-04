"""Pricing analytics list endpoint - POST /analytics/pricing/list."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.analytics.pricing.types import (
    GetPricingRunsRequest,
    GetPricingRunsResponse,
    PricingAgentItem,
    PricingDebugInfoItem,
    PricingFilterOption,
    PricingGroupRunItem,
    PricingModelItem,
    PricingProfileItem,
    PricingRunSummaryItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def _get_profile_role(conn: asyncpg.Connection, profile_id: UUID) -> str | None:
    return await conn.fetchval(
        """
        SELECT r.role
        FROM profile_roles_junction pr
        JOIN roles_resource r ON r.id = pr.role_id
        WHERE pr.profile_id = $1
        LIMIT 1
        """,
        profile_id,
    )


def _build_run_filters(
    *,
    start_date: datetime | None,
    end_date: datetime | None,
    department_ids: list[UUID],
    roles: list[str],
    cohort_ids: list[UUID],
    effective_profile_id: UUID | None,
    model_ids: list[UUID],
    profile_ids: list[UUID],
    actor_ids: list[UUID],
    search: str | None,
) -> tuple[list[str], list[object]]:
    conditions: list[str] = []
    params: list[object] = []

    if start_date:
        params.append(start_date)
        conditions.append(f"r.run_created_at >= ${len(params)}")
    if end_date:
        params.append(end_date)
        conditions.append(f"r.run_created_at <= ${len(params)}")

    if effective_profile_id:
        params.append(effective_profile_id)
        conditions.append(f"r.profile_id = ${len(params)}")

    if department_ids:
        params.append(department_ids)
        conditions.append(
            f"""
            EXISTS (
                SELECT 1 FROM profile_departments_junction pd
                WHERE pd.profile_id = r.profile_id
                  AND pd.department_id = ANY(${len(params)})
            )
            """
        )

    if roles:
        params.append(roles)
        conditions.append(
            f"""
            EXISTS (
                SELECT 1
                FROM profile_roles_junction pr
                JOIN roles_resource rr ON rr.id = pr.role_id
                WHERE pr.profile_id = r.profile_id
                  AND rr.role = ANY(${len(params)})
            )
            """
        )

    if cohort_ids:
        params.append(cohort_ids)
        conditions.append(
            f"""
            EXISTS (
                SELECT 1 FROM profile_cohorts_junction pc
                WHERE pc.profile_id = r.profile_id
                  AND pc.cohort_id = ANY(${len(params)})
                  AND pc.active = TRUE
            )
            """
        )

    if model_ids:
        params.append(model_ids)
        conditions.append(f"r.model_id = ANY(${len(params)})")

    if profile_ids:
        params.append(profile_ids)
        conditions.append(f"r.profile_id = ANY(${len(params)})")

    if actor_ids:
        params.append(actor_ids)
        conditions.append(f"r.agent_id = ANY(${len(params)})")

    if search:
        pattern = f"%{search.lower()}%"
        params.append(pattern)
        conditions.append(
            f"""
            (
                LOWER(COALESCE(r.group_name, '')) LIKE ${len(params)}
                OR LOWER(COALESCE(r.trace_id, '')) LIKE ${len(params)}
                OR EXISTS (
                    SELECT 1
                    FROM model_names_junction mn
                    JOIN names_resource n ON n.id = mn.name_id
                    WHERE mn.model_id = r.model_id
                      AND LOWER(n.name) LIKE ${len(params)}
                )
                OR EXISTS (
                    SELECT 1
                    FROM profile_names_junction pn
                    JOIN names_resource n ON n.id = pn.name_id
                    WHERE pn.profile_id = r.profile_id
                      AND LOWER(n.name) LIKE ${len(params)}
                )
                OR EXISTS (
                    SELECT 1
                    FROM agent_names_junction an
                    JOIN names_resource n ON n.id = an.name_id
                    WHERE an.agent_id = r.agent_id
                      AND LOWER(n.name) LIKE ${len(params)}
                )
                OR EXISTS (
                    SELECT 1
                    FROM view_debug_info_entry di
                    WHERE di.run_id = r.run_id
                      AND LOWER(di.content) LIKE ${len(params)}
                )
            )
            """
        )

    return conditions, params


async def _fetch_model_rows(
    conn: asyncpg.Connection, model_ids: list[UUID]
) -> list[PricingModelItem]:
    if not model_ids:
        return []
    rows = await conn.fetch(
        """
        SELECT
            m.id AS model_id,
            n.name AS name,
            d.description AS description
        FROM model_artifact m
        LEFT JOIN model_names_junction mn ON mn.model_id = m.id
        LEFT JOIN names_resource n ON n.id = mn.name_id
        LEFT JOIN model_descriptions_junction md ON md.model_id = m.id
        LEFT JOIN descriptions_resource d ON d.id = md.description_id
        WHERE m.id = ANY($1)
        """,
        model_ids,
    )
    return [
        PricingModelItem(
            model_id=row["model_id"],
            name=row["name"],
            description=row["description"],
            input_ppm=Decimal("0"),
            output_ppm=Decimal("0"),
        )
        for row in rows
    ]


async def _fetch_profile_rows(
    conn: asyncpg.Connection, profile_ids: list[UUID]
) -> list[PricingProfileItem]:
    if not profile_ids:
        return []
    rows = await conn.fetch(
        """
        SELECT
            p.id AS profile_id,
            n.name AS name
        FROM profile_artifact p
        LEFT JOIN profile_names_junction pn ON pn.profile_id = p.id
        LEFT JOIN names_resource n ON n.id = pn.name_id
        WHERE p.id = ANY($1)
        """,
        profile_ids,
    )
    return [
        PricingProfileItem(profile_id=row["profile_id"], name=row["name"])
        for row in rows
    ]


async def _fetch_agent_rows(
    conn: asyncpg.Connection, agent_ids: list[UUID]
) -> list[PricingAgentItem]:
    if not agent_ids:
        return []
    rows = await conn.fetch(
        """
        SELECT
            a.id AS agent_id,
            n.name AS name
        FROM agent_artifact a
        LEFT JOIN agent_names_junction an ON an.agent_id = a.id
        LEFT JOIN names_resource n ON n.id = an.name_id
        WHERE a.id = ANY($1)
        """,
        agent_ids,
    )
    return [
        PricingAgentItem(agent_id=row["agent_id"], name=row["name"])
        for row in rows
    ]


async def get_pricing_runs_internal(
    conn: asyncpg.Connection,
    request: GetPricingRunsRequest,
    profile_id: UUID | None,
    bypass_cache: bool = False,
) -> GetPricingRunsResponse:
    cache_key_val = cache_key(
        "analytics/pricing/list",
        request.model_dump(mode="json"),
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetPricingRunsResponse.model_validate(cached)

    actor_name: str | None = None
    effective_profile_id: UUID | None = None
    if profile_id:
        role = await _get_profile_role(conn, profile_id)
        if role not in {"admin", "superadmin", "instructional"}:
            effective_profile_id = profile_id

        actor_name = await conn.fetchval(
            """
            SELECT n.name
            FROM profile_names_junction pn
            JOIN names_resource n ON n.id = pn.name_id
            WHERE pn.profile_id = $1
            LIMIT 1
            """,
            profile_id,
        )

    conditions, params = _build_run_filters(
        start_date=request.start_date,
        end_date=request.end_date,
        department_ids=request.department_ids,
        roles=request.roles,
        cohort_ids=request.cohort_ids,
        effective_profile_id=effective_profile_id,
        model_ids=request.model_ids,
        profile_ids=request.profile_ids,
        actor_ids=request.actor_ids,
        search=request.search.strip() if request.search else None,
    )
    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    total_count = await conn.fetchval(
        f"""
        SELECT COUNT(*) FROM (
            SELECT r.group_id
            FROM mv_pricing_run_facts r
            WHERE {where_clause} AND r.group_id IS NOT NULL
            GROUP BY r.group_id
        ) s
        """,
        *params,
    )

    sort_column = {
        "createdAt": "created_at",
        "inputTokens": "total_input_tokens",
        "outputTokens": "total_output_tokens",
        "cost": "total_cost",
        "runCount": "run_count",
    }.get(request.sort_by, "created_at")
    sort_order = "ASC" if request.sort_order.lower() == "asc" else "DESC"

    group_rows = await conn.fetch(
        f"""
        SELECT
            r.group_id,
            MIN(r.run_created_at) AS created_at,
            COUNT(*)::int AS run_count,
            SUM(r.input_tokens)::bigint AS total_input_tokens,
            SUM(r.output_tokens)::bigint AS total_output_tokens,
            SUM(r.total_cost)::numeric AS total_cost
        FROM mv_pricing_run_facts r
        WHERE {where_clause} AND r.group_id IS NOT NULL
        GROUP BY r.group_id
        ORDER BY {sort_column} {sort_order} NULLS LAST
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
        """,
        *params,
        request.limit_count,
        request.offset_count,
    )

    group_ids = [row["group_id"] for row in group_rows]

    runs_rows = []
    if group_ids:
        runs_rows = await conn.fetch(
            """
            SELECT
                r.run_id,
                r.group_id,
                r.run_created_at,
                r.input_tokens,
                r.output_tokens,
                r.total_cost,
                r.model_id,
                r.profile_id,
                r.agent_id
            FROM mv_pricing_run_facts r
            WHERE r.group_id = ANY($1)
            ORDER BY r.group_id, r.run_created_at
            """,
            group_ids,
        )

    run_ids = [row["run_id"] for row in runs_rows]
    debug_map: dict[UUID, list[PricingDebugInfoItem]] = {}
    if run_ids:
        debug_rows = await conn.fetch(
            """
            SELECT id, run_id, created_at, content
            FROM view_debug_info_entry
            WHERE run_id = ANY($1)
            ORDER BY created_at
            """,
            run_ids,
        )
        for row in debug_rows:
            debug_map.setdefault(row["run_id"], []).append(
                PricingDebugInfoItem(
                    id=row["id"],
                    created_at=row["created_at"],
                    content=row["content"],
                )
            )

    group_map: dict[UUID, PricingGroupRunItem] = {}
    for row in group_rows:
        group_map[row["group_id"]] = PricingGroupRunItem(
            group_id=row["group_id"],
            created_at=row["created_at"],
            run_count=row["run_count"] or 0,
            total_input_tokens=int(row["total_input_tokens"] or 0),
            total_output_tokens=int(row["total_output_tokens"] or 0),
            total_cost=Decimal(str(row["total_cost"] or 0)),
            runs_entry=[],
        )

    model_ids: set[UUID] = set()
    profile_ids: set[UUID] = set()
    agent_ids: set[UUID] = set()

    for row in runs_rows:
        group = group_map.get(row["group_id"])
        if not group:
            continue

        if row["model_id"]:
            model_ids.add(row["model_id"])
        if row["profile_id"]:
            profile_ids.add(row["profile_id"])
        if row["agent_id"]:
            agent_ids.add(row["agent_id"])

        group.runs_entry.append(
            PricingRunSummaryItem(
                run_id=row["run_id"],
                created_at=row["run_created_at"],
                input_tokens=row["input_tokens"] or 0,
                output_tokens=row["output_tokens"] or 0,
                cost=Decimal(str(row["total_cost"] or 0)),
                model_id=row["model_id"],
                profile_id=row["profile_id"],
                agent_id=row["agent_id"],
                debug_info_entry=debug_map.get(row["run_id"], []),
            )
        )

    model_option_rows = await conn.fetch(
        f"""
        SELECT r.model_id, COUNT(DISTINCT r.run_id)::int AS count
        FROM mv_pricing_run_facts r
        WHERE {where_clause} AND r.model_id IS NOT NULL
        GROUP BY r.model_id
        """,
        *params,
    )
    profile_option_rows = await conn.fetch(
        f"""
        SELECT r.profile_id, COUNT(DISTINCT r.run_id)::int AS count
        FROM mv_pricing_run_facts r
        WHERE {where_clause} AND r.profile_id IS NOT NULL
        GROUP BY r.profile_id
        """,
        *params,
    )
    actor_option_rows = await conn.fetch(
        f"""
        SELECT r.agent_id, COUNT(DISTINCT r.run_id)::int AS count
        FROM mv_pricing_run_facts r
        WHERE {where_clause} AND r.agent_id IS NOT NULL
        GROUP BY r.agent_id
        """,
        *params,
    )

    option_model_ids = [row["model_id"] for row in model_option_rows]
    option_profile_ids = [row["profile_id"] for row in profile_option_rows]
    option_agent_ids = [row["agent_id"] for row in actor_option_rows]

    model_rows = await _fetch_model_rows(conn, option_model_ids)
    profile_rows = await _fetch_profile_rows(conn, option_profile_ids)
    agent_rows = await _fetch_agent_rows(conn, option_agent_ids)

    model_name_map = {row.model_id: row.name for row in model_rows}
    profile_name_map = {row.profile_id: row.name for row in profile_rows}
    agent_name_map = {row.agent_id: row.name for row in agent_rows}

    model_options = [
        PricingFilterOption(
            value=str(row["model_id"]),
            label=model_name_map.get(row["model_id"]),
            count=row["count"],
        )
        for row in model_option_rows
    ]
    profile_options = [
        PricingFilterOption(
            value=str(row["profile_id"]),
            label=profile_name_map.get(row["profile_id"]),
            count=row["count"],
        )
        for row in profile_option_rows
    ]
    actor_options = [
        PricingFilterOption(
            value=str(row["agent_id"]),
            label=agent_name_map.get(row["agent_id"]),
            count=row["count"],
        )
        for row in actor_option_rows
    ]

    page = (
        request.offset_count // request.limit_count
        if request.limit_count
        else 0
    )
    total_pages = (
        (int(total_count) + request.limit_count - 1) // request.limit_count
        if request.limit_count
        else 0
    )

    ordered_groups = [group_map[row["group_id"]] for row in group_rows if row["group_id"] in group_map]

    response = GetPricingRunsResponse(
        actor_name=actor_name or "System",
        group_runs=ordered_groups,
        total_count=int(total_count or 0),
        page=page,
        page_size=request.limit_count,
        total_pages=total_pages,
        model_options=model_options,
        profile_options=profile_options,
        actor_options=actor_options,
        models=model_rows,
        profiles=profile_rows,
        agents=agent_rows,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=300,
        tags=["analytics", "pricing"],
    )

    return response


@router.post(
    "/list",
    response_model=GetPricingRunsResponse,
    dependencies=[
        audit_activity("analytics.pricing.list", "{{ actor.name }} viewed pricing runs")
    ],
)
async def get_pricing_runs(
    request: GetPricingRunsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPricingRunsResponse:
    """Get pricing runs list."""
    tags = ["analytics", "pricing"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id_val = http_request.state.profile_id
        profile_id = UUID(profile_id_val) if profile_id_val else None

        result = await get_pricing_runs_internal(
            conn=conn,
            request=request,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="analytics_pricing_list",
            request=http_request,
        )

"""Pricing analytics summary endpoint - POST /analytics/pricing/get."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.analytics.pricing.types import (
    GetPricingAnalyticsRequest,
    GetPricingAnalyticsResponse,
    PricingAgentItem,
    PricingModelItem,
    PricingModelRunItem,
    PricingProfileItem,
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

    return conditions, params


async def get_pricing_analytics_internal(
    conn: asyncpg.Connection,
    request: GetPricingAnalyticsRequest,
    profile_id: UUID | None,
    bypass_cache: bool = False,
) -> GetPricingAnalyticsResponse:
    cache_key_val = cache_key(
        "analytics/pricing/get",
        request.model_dump(mode="json"),
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetPricingAnalyticsResponse.model_validate(cached)

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
    )

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    rows = await conn.fetch(
        f"""
        SELECT
            r.run_id,
            r.run_created_at,
            r.input_tokens,
            r.output_tokens,
            r.model_id,
            r.profile_id,
            r.agent_id,
            r.total_cost
        FROM mv_pricing_run_facts r
        WHERE {where_clause}
        ORDER BY r.run_created_at DESC
        """,
        *params,
    )

    model_ids: set[UUID] = set()
    profile_ids: set[UUID] = set()
    agent_ids: set[UUID] = set()

    model_runs = []
    for row in rows:
        if row["model_id"]:
            model_ids.add(row["model_id"])
        if row["profile_id"]:
            profile_ids.add(row["profile_id"])
        if row["agent_id"]:
            agent_ids.add(row["agent_id"])

        model_runs.append(
            PricingModelRunItem(
                run_id=row["run_id"],
                created_at=row["run_created_at"],
                input_tokens=row["input_tokens"] or 0,
                output_tokens=row["output_tokens"] or 0,
                model_id=row["model_id"],
                profile_id=row["profile_id"],
                agent_id=row["agent_id"],
                run_cost=Decimal(str(row["total_cost"] or 0)),
                debug_info=[],
            )
        )

    models = []
    if model_ids:
        model_rows = await conn.fetch(
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
            list(model_ids),
        )
        models = [
            PricingModelItem(
                model_id=row["model_id"],
                name=row["name"],
                description=row["description"],
                input_ppm=Decimal("0"),
                output_ppm=Decimal("0"),
            )
            for row in model_rows
        ]

    profiles = []
    if profile_ids:
        profile_rows = await conn.fetch(
            """
            SELECT
                p.id AS profile_id,
                n.name AS name
            FROM profile_artifact p
            LEFT JOIN profile_names_junction pn ON pn.profile_id = p.id
            LEFT JOIN names_resource n ON n.id = pn.name_id
            WHERE p.id = ANY($1)
            """,
            list(profile_ids),
        )
        profiles = [
            PricingProfileItem(profile_id=row["profile_id"], name=row["name"])
            for row in profile_rows
        ]

    agents = []
    if agent_ids:
        agent_rows = await conn.fetch(
            """
            SELECT
                a.id AS agent_id,
                n.name AS name
            FROM agent_artifact a
            LEFT JOIN agent_names_junction an ON an.agent_id = a.id
            LEFT JOIN names_resource n ON n.id = an.name_id
            WHERE a.id = ANY($1)
            """,
            list(agent_ids),
        )
        agents = [
            PricingAgentItem(agent_id=row["agent_id"], name=row["name"])
            for row in agent_rows
        ]

    response = GetPricingAnalyticsResponse(
        actor_name=actor_name or "System",
        model_runs=model_runs,
        models=models,
        profiles=profiles,
        agents=agents,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=300,
        tags=["analytics", "pricing"],
    )

    return response


@router.post(
    "/get",
    response_model=GetPricingAnalyticsResponse,
    dependencies=[
        audit_activity(
            "analytics.pricing.get", "{{ actor.name }} viewed pricing analytics"
        )
    ],
)
async def get_pricing_analytics(
    request: GetPricingAnalyticsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPricingAnalyticsResponse:
    """Get pricing analytics summary."""
    tags = ["analytics", "pricing"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id_val = http_request.state.profile_id
        profile_id = UUID(profile_id_val) if profile_id_val else None

        result = await get_pricing_analytics_internal(
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
            operation="analytics_pricing_get",
            request=http_request,
        )

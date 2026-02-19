"""Analytics filters endpoint — per-page filter config + MV-backed options.

Returns filter field visibility and option lists based on the current page.
Called alongside context from layout-server.tsx.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.auth.types import (
    AnalyticsFilterField,
    AnalyticsFilterFields,
    AnalyticsFilterOption,
    GetAnalyticsFiltersApiResponse,
)
from app.main import get_db, get_pool
from app.sql.types import (
    GetProfileContextAccessSqlParams,
    GetProfileContextAccessSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_ACCESS_PATH = "app/sql/v4/queries/profile/get_profile_context_access_complete.sql"

router = APIRouter()

# ---------------------------------------------------------------------------
# Per-page filter configuration
# ---------------------------------------------------------------------------

HIDDEN = AnalyticsFilterField(visible=False)
VISIBLE = AnalyticsFilterField(visible=True)


@dataclass
class PageFilterConfig:
    """Static per-page filter configuration."""

    fields: AnalyticsFilterFields
    mv_source: str  # "profile_facts" | "pricing" | "benchmark" | "health"
    attempt_options: list[str] = field(default_factory=list)


PAGE_FILTER_CONFIGS: dict[str, PageFilterConfig] = {
    "/home": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=VISIBLE,
            cohorts=VISIBLE,
            roles=HIDDEN,
            attempts=HIDDEN,
        ),
        mv_source="profile_facts",
    ),
    "/practice": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=VISIBLE,
            cohorts=VISIBLE,
            roles=HIDDEN,
            attempts=HIDDEN,
        ),
        mv_source="profile_facts",
    ),
    "/leaderboard": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=VISIBLE,
            cohorts=VISIBLE,
            roles=HIDDEN,
            attempts=VISIBLE,
        ),
        mv_source="profile_facts",
        attempt_options=["general", "practice", "archived"],
    ),
    "/analytics/dashboard": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=VISIBLE,
            cohorts=VISIBLE,
            roles=VISIBLE,
            attempts=VISIBLE,
        ),
        mv_source="profile_facts",
        attempt_options=["general", "practice", "archived"],
    ),
    "/analytics/reports": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=VISIBLE,
            cohorts=VISIBLE,
            roles=VISIBLE,
            attempts=VISIBLE,
        ),
        mv_source="profile_facts",
        attempt_options=["general", "practice", "archived"],
    ),
    "/analytics/reports/[id]": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=VISIBLE,
            cohorts=VISIBLE,
            roles=HIDDEN,
            attempts=VISIBLE,
        ),
        mv_source="profile_facts",
        attempt_options=["general", "practice", "archived"],
    ),
    "/analytics/pricing": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=VISIBLE,
            cohorts=HIDDEN,
            roles=HIDDEN,
            attempts=HIDDEN,
        ),
        mv_source="pricing",
    ),
    "/health": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=HIDDEN,
            cohorts=HIDDEN,
            roles=HIDDEN,
            attempts=HIDDEN,
        ),
        mv_source="health",
    ),
    "/benchmark": PageFilterConfig(
        fields=AnalyticsFilterFields(
            date_range=VISIBLE,
            departments=VISIBLE,
            cohorts=HIDDEN,
            roles=HIDDEN,
            attempts=VISIBLE,
        ),
        mv_source="benchmark",
        attempt_options=["general", "archived"],
    ),
}


def get_page_filter_config(pathname: str) -> PageFilterConfig | None:
    """Resolve a pathname to its filter configuration."""
    if pathname in PAGE_FILTER_CONFIGS:
        return PAGE_FILTER_CONFIGS[pathname]
    # Dynamic routes
    if pathname.startswith("/analytics/reports/") and len(pathname.split("/")) >= 4:
        return PAGE_FILTER_CONFIGS["/analytics/reports/[id]"]
    if pathname.startswith("/analytics/pricing/"):
        return PAGE_FILTER_CONFIGS["/analytics/pricing"]
    if pathname.startswith("/benchmark/"):
        return PAGE_FILTER_CONFIGS["/benchmark"]
    return None


# ---------------------------------------------------------------------------
# Per-MV fetch functions
# ---------------------------------------------------------------------------


async def fetch_profile_facts_filters(
    pool: asyncpg.Pool,
    dept_ids: list[str],
    cohort_ids: list[str],
    fields: AnalyticsFilterFields,
) -> tuple[
    list[AnalyticsFilterOption],
    list[AnalyticsFilterOption],
    str | None,
    str | None,
]:
    """Fetch filter options from attempt_chat_mv."""
    dept_opts: list[AnalyticsFilterOption] = []
    cohort_opts: list[AnalyticsFilterOption] = []
    earliest: str | None = None
    latest: str | None = None

    if fields.departments.visible and dept_ids:
        async with pool.acquire() as c:
            rows = await c.fetch(
                """
                SELECT DISTINCT pf.department_id, dr.name
                FROM attempt_chat_mv pf
                JOIN departments_resource dr ON dr.id = pf.department_id
                WHERE pf.department_id = ANY($1::uuid[])
                ORDER BY dr.name
                """,
                [UUID(did) for did in dept_ids],
            )
            dept_opts = [
                AnalyticsFilterOption(value=str(r["department_id"]), label=r["name"])
                for r in rows
            ]

    if fields.cohorts.visible and cohort_ids:
        async with pool.acquire() as c:
            rows = await c.fetch(
                """
                SELECT DISTINCT pf.cohort_id, cr.name
                FROM attempt_chat_mv pf
                JOIN cohorts_resource cr ON cr.id = pf.cohort_id
                WHERE pf.cohort_id = ANY($1::uuid[])
                ORDER BY cr.name
                """,
                [UUID(cid) for cid in cohort_ids],
            )
            cohort_opts = [
                AnalyticsFilterOption(value=str(r["cohort_id"]), label=r["name"])
                for r in rows
            ]

    if fields.date_range.visible and dept_ids:
        async with pool.acquire() as c:
            row = await c.fetchrow(
                """
                SELECT MIN(attempt_date) as earliest,
                       MAX(attempt_date) as latest
                FROM attempt_chat_mv
                WHERE department_id = ANY($1::uuid[])
                """,
                [UUID(did) for did in dept_ids],
            )
            if row and row["earliest"]:
                earliest = row["earliest"].isoformat()
                latest = row["latest"].isoformat()

    return dept_opts, cohort_opts, earliest, latest


async def fetch_pricing_filters(
    pool: asyncpg.Pool,
    dept_ids: list[str],
    fields: AnalyticsFilterFields,
) -> tuple[
    list[AnalyticsFilterOption],
    list[AnalyticsFilterOption],
    str | None,
    str | None,
]:
    """Fetch filter options from pricing MVs.

    Note: pricing MVs don't have department_id — departments are resolved
    from the user's accessible departments via departments_resource.
    """
    dept_opts: list[AnalyticsFilterOption] = []
    earliest: str | None = None
    latest: str | None = None

    if fields.departments.visible and dept_ids:
        async with pool.acquire() as c:
            rows = await c.fetch(
                """
                SELECT id as department_id, name
                FROM departments_resource
                WHERE id = ANY($1::uuid[])
                ORDER BY name
                """,
                [UUID(did) for did in dept_ids],
            )
            dept_opts = [
                AnalyticsFilterOption(value=str(r["department_id"]), label=r["name"])
                for r in rows
            ]

    if fields.date_range.visible:
        from app.api.v4.entries.runs.list import get_run_list_entries_internal

        async with pool.acquire() as c_earliest, pool.acquire() as c_latest:
            earliest_result, latest_result = await asyncio.gather(
                get_run_list_entries_internal(
                    conn=c_earliest,
                    sort_by="date",
                    sort_order="asc",
                    page_limit=1,
                    page_offset=0,
                ),
                get_run_list_entries_internal(
                    conn=c_latest,
                    sort_by="date",
                    sort_order="desc",
                    page_limit=1,
                    page_offset=0,
                ),
            )
            if earliest_result.items:
                earliest_dt = earliest_result.items[0].run_created_at
                if earliest_dt:
                    earliest = earliest_dt.date().isoformat()
            if latest_result.items:
                latest_dt = latest_result.items[0].run_created_at
                if latest_dt:
                    latest = latest_dt.date().isoformat()

    return dept_opts, [], earliest, latest


async def fetch_benchmark_filters(
    pool: asyncpg.Pool,
    dept_ids: list[str],
    fields: AnalyticsFilterFields,
) -> tuple[
    list[AnalyticsFilterOption],
    list[AnalyticsFilterOption],
    str | None,
    str | None,
]:
    """Fetch filter options from mv_benchmark_eval_summary."""
    dept_opts: list[AnalyticsFilterOption] = []
    earliest: str | None = None
    latest: str | None = None

    if fields.departments.visible and dept_ids:
        async with pool.acquire() as c:
            rows = await c.fetch(
                """
                SELECT DISTINCT unnest(bes.department_ids) as department_id, dr.name
                FROM mv_benchmark_eval_summary bes
                JOIN departments_resource dr ON dr.id = ANY(bes.department_ids)
                WHERE bes.department_ids && $1::uuid[]
                ORDER BY dr.name
                """,
                [UUID(did) for did in dept_ids],
            )
            # Deduplicate and filter to only accessible departments
            dept_id_set = set(dept_ids)
            seen: set[str] = set()
            for r in rows:
                did = str(r["department_id"])
                if did in dept_id_set and did not in seen:
                    seen.add(did)
                    dept_opts.append(AnalyticsFilterOption(value=did, label=r["name"]))

    if fields.date_range.visible:
        async with pool.acquire() as c:
            row = await c.fetchrow(
                """
                SELECT MIN(created_at) as earliest, MAX(created_at) as latest
                FROM mv_benchmark_eval_summary
                """,
            )
            if row and row["earliest"]:
                earliest = row["earliest"].isoformat()
                latest = row["latest"].isoformat()

    return dept_opts, [], earliest, latest


async def fetch_health_filters(
    pool: asyncpg.Pool,
    fields: AnalyticsFilterFields,
) -> tuple[
    list[AnalyticsFilterOption],
    list[AnalyticsFilterOption],
    str | None,
    str | None,
]:
    """Fetch filter options from mv_health_metrics_hourly."""
    earliest: str | None = None
    latest: str | None = None

    if fields.date_range.visible:
        async with pool.acquire() as c:
            row = await c.fetchrow(
                """
                SELECT MIN(date_hour) as earliest, MAX(date_hour) as latest
                FROM mv_health_metrics_hourly
                """,
            )
            if row and row["earliest"]:
                earliest = row["earliest"].isoformat()
                latest = row["latest"].isoformat()

    return [], [], earliest, latest


# ---------------------------------------------------------------------------
# HTTP endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/analytics",
    response_model=GetAnalyticsFiltersApiResponse | None,
)
async def get_analytics_filters(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAnalyticsFiltersApiResponse | None:
    """Return per-page analytics filter config and MV-backed options.

    Returns None for pages that don't show analytics filters.
    """
    pathname = http_request.headers.get("X-Pathname", "")
    config = get_page_filter_config(pathname)
    if config is None:
        return None

    # Re-run the lightweight access SQL to get department_ids, cohort_ids, scoped_roles
    try:
        profile_id = cast(UUID | None, http_request.state.profile_id)
    except AttributeError:
        profile_id = None

    params = GetProfileContextAccessSqlParams(
        profile_id=profile_id,
        department_id=None,
    )
    access = cast(
        GetProfileContextAccessSqlRow | None,
        await execute_sql_typed(conn, SQL_ACCESS_PATH, params=params),
    )
    if not access:
        return None

    dept_ids = [str(d) for d in (access.department_ids or [])]
    cohort_ids = [str(c) for c in (access.cohort_ids or [])]
    scoped_roles = access.scoped_roles or []

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database pool not available")

    # Dispatch to the appropriate MV fetch function
    if config.mv_source == "profile_facts":
        dept_opts, cohort_opts, earliest, latest = await fetch_profile_facts_filters(
            pool, dept_ids, cohort_ids, config.fields
        )
    elif config.mv_source == "pricing":
        dept_opts, cohort_opts, earliest, latest = await fetch_pricing_filters(
            pool, dept_ids, config.fields
        )
    elif config.mv_source == "benchmark":
        dept_opts, cohort_opts, earliest, latest = await fetch_benchmark_filters(
            pool, dept_ids, config.fields
        )
    elif config.mv_source == "health":
        dept_opts, cohort_opts, earliest, latest = await fetch_health_filters(
            pool, config.fields
        )
    else:
        dept_opts, cohort_opts, earliest, latest = [], [], None, None

    # Build role options from scoped_roles when visible
    role_options = scoped_roles if config.fields.roles.visible else []

    return GetAnalyticsFiltersApiResponse(
        fields=config.fields,
        department_options=dept_opts,
        cohort_options=cohort_opts,
        role_options=role_options,
        attempt_options=config.attempt_options,
        date_range_earliest=earliest,
        date_range_latest=latest,
    )

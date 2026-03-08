"""Analytics filters endpoint — thin route, delegates to infra.

Returns filter field visibility and option lists based on the current page.
Called alongside context from layout-server.tsx.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Annotated, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.infra.auth.analytics import (
    resolve_benchmark_filters,
    resolve_health_filters,
    resolve_pricing_filters,
    resolve_profile_facts_filters,
)
from app.infra.auth.simulatable import SIMULATABLE_ROLES
from app.infra.globals import get_db, get_pool, get_redis_client
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.auth.types import (
    AnalyticsFilterField,
    AnalyticsFilterFields,
    AnalyticsFilterOption,
    GetAnalyticsFiltersApiResponse,
)
from app.routes.v5.tools.artifacts.cohort.get import get_cohorts as get_cohort_artifacts
from app.routes.v5.tools.artifacts.cohort.search import search_cohorts

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
    # Dynamic routes — canonical top-level routes
    if pathname.startswith("/record/"):
        return PAGE_FILTER_CONFIGS["/analytics/reports/[id]"]
    if pathname.startswith("/group/"):
        return PAGE_FILTER_CONFIGS["/analytics/pricing"]
    if pathname.startswith("/session/"):
        return None  # No filters for session detail
    if pathname.startswith("/test/"):
        return PAGE_FILTER_CONFIGS["/benchmark"]
    if pathname.startswith("/invocation/"):
        return PAGE_FILTER_CONFIGS["/benchmark"]
    # Legacy nested routes
    if pathname.startswith("/analytics/reports/") and len(pathname.split("/")) >= 4:
        return PAGE_FILTER_CONFIGS["/analytics/reports/[id]"]
    if pathname.startswith("/analytics/pricing/"):
        return PAGE_FILTER_CONFIGS["/analytics/pricing"]
    if pathname.startswith("/benchmark/"):
        return PAGE_FILTER_CONFIGS["/benchmark"]
    return None


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
    """Return per-page analytics filter config and MV-backed options."""
    pathname = http_request.headers.get("X-Pathname", "")
    config = get_page_filter_config(pathname)
    if config is None:
        return None

    try:
        profile_id = cast(UUID | None, http_request.state.profile_id)
    except AttributeError:
        profile_id = None

    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    if not profile_id:
        return None

    redis = get_redis_client()
    identity = await resolve_profile_identity_context(
        conn, profile_id, redis, bypass_cache=bypass_cache
    )
    if not identity:
        return None

    dept_ids = list(identity.department_ids or [])
    scoped_roles = list(SIMULATABLE_ROLES.get(identity.role, set()))

    # Resolve cohort resource IDs via black boxes
    cohort_ids: list[UUID] = []
    if identity.profiles_id:
        cohort_artifact_ids, _ = await search_cohorts(
            conn, profile_ids=[identity.profiles_id], active_only=True, limit_count=1000
        )
        if cohort_artifact_ids:
            pool_for_cohorts = get_pool()
            if pool_for_cohorts:
                async with pool_for_cohorts.acquire() as c:
                    cohort_arts = await get_cohort_artifacts(
                        c, cohort_artifact_ids, cohorts=True
                    )
                    for ca in cohort_arts:
                        cohort_ids.extend(ca.cohort_ids or [])

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database pool not available")

    fields = config.fields

    # Dispatch to the appropriate infra resolver
    if config.mv_source == "profile_facts":
        result = await resolve_profile_facts_filters(
            pool,
            redis,
            department_ids=dept_ids,
            cohort_ids=cohort_ids,
            need_departments=fields.departments.visible,
            need_cohorts=fields.cohorts.visible,
            need_date_range=fields.date_range.visible,
            bypass_cache=bypass_cache,
        )
    elif config.mv_source == "pricing":
        result = await resolve_pricing_filters(
            pool,
            redis,
            department_ids=dept_ids,
            need_departments=fields.departments.visible,
            need_date_range=fields.date_range.visible,
            bypass_cache=bypass_cache,
        )
    elif config.mv_source == "benchmark":
        result = await resolve_benchmark_filters(
            pool,
            redis,
            department_ids=dept_ids,
            need_departments=fields.departments.visible,
            need_date_range=fields.date_range.visible,
            bypass_cache=bypass_cache,
        )
    elif config.mv_source == "health":
        result = await resolve_health_filters(
            pool,
            need_date_range=fields.date_range.visible,
        )
    else:
        from app.infra.auth.analytics import AnalyticsFiltersResult

        result = AnalyticsFiltersResult()

    # Map infra FilterOption → route AnalyticsFilterOption
    dept_opts = [
        AnalyticsFilterOption(value=o.value, label=o.label)
        for o in result.department_options
    ]
    cohort_opts = [
        AnalyticsFilterOption(value=o.value, label=o.label)
        for o in result.cohort_options
    ]

    role_options = scoped_roles if fields.roles.visible else []

    return GetAnalyticsFiltersApiResponse(
        fields=fields,
        department_options=dept_opts,
        cohort_options=cohort_opts,
        role_options=role_options,
        attempt_options=config.attempt_options,
        date_range_earliest=result.date_range_earliest,
        date_range_latest=result.date_range_latest,
    )

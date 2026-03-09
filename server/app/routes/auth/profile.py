"""POST /auth/profile — identity + permissions endpoint."""

from __future__ import annotations

import asyncio
import time
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.auth.simulatable import SIMULATABLE_ROLES
from app.infra.globals import get_db, get_pool, get_redis_client
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.sessions.get import get_session_internal
from app.routes.auth.callback import resolve_redirect_path
from app.routes.auth.permissions import convert_role
from app.routes.auth.route_permissions import (
    compute_available_routes,
    compute_available_sections,
)
from app.routes.auth.types import AuthProfileInternalData, GetAuthProfileApiResponse
from app.routes.shared_types import GetProfileContextApiRequest
from app.routes.v5.tools.artifacts.cohort.get import get_cohorts as get_cohort_artifacts
from app.routes.v5.tools.artifacts.cohort.search import search_cohorts
from app.routes.v5.tools.resources.cohorts.get import get_cohorts
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.roles.get import get_roles
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


async def get_auth_profile_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None,
    bypass_cache: bool = False,
) -> AuthProfileInternalData:
    """Resolve profile identity graph — identity context + hydrated departments/cohorts.

    Underlying resource calls are individually cached, so repeated calls
    across artifact endpoints within the same request window are cheap.
    """
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile ID is required")

    redis = get_redis_client()

    identity = await resolve_profile_identity_context(
        conn, profile_id, redis, bypass_cache=bypass_cache
    )
    if not identity:
        raise HTTPException(status_code=404, detail="Profile not found")

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database pool not available")

    # Compute scoped_roles from identity.role via SIMULATABLE_ROLES
    scoped_roles = sorted(SIMULATABLE_ROLES.get(identity.role, set()))

    department_ids = identity.department_ids or []

    # Resolve cohort_ids: search cohorts by profile, then get cohort artifacts
    # to extract cohorts_resource IDs
    async def resolve_cohort_ids() -> list[UUID]:
        async with pool.acquire() as c:
            cohort_artifact_ids, _ = await search_cohorts(
                c, profile_ids=[identity.profiles_id]
            )
            if not cohort_artifact_ids:
                return []
            cohort_artifacts = await get_cohort_artifacts(
                c, cohort_artifact_ids, cohorts=True
            )
            resource_ids: list[UUID] = []
            for ca in cohort_artifacts:
                if ca.cohort_ids:
                    resource_ids.extend(ca.cohort_ids)
            return resource_ids

    async def fetch_departments():
        if not department_ids:
            return []
        async with pool.acquire() as c:
            return await get_departments(
                c, department_ids, redis, bypass_cache=bypass_cache
            )

    async def fetch_cohorts(cohort_ids: list[UUID]):
        if not cohort_ids:
            return []
        async with pool.acquire() as c:
            return await get_cohorts(c, cohort_ids, redis, bypass_cache)

    async def fetch_roles():
        async with pool.acquire() as c:
            return await get_roles(c, None, redis, bypass_cache=bypass_cache)

    async def fetch_session():
        async with pool.acquire() as c:
            return await get_session_internal(c, profile_id, bypass_cache)

    # First resolve cohort resource IDs, then fetch cohort resources in parallel
    # with departments, roles, and session
    cohort_resource_ids = await resolve_cohort_ids()

    (
        departments,
        cohorts,
        roles_raw,
        session_id,
    ) = await asyncio.gather(
        fetch_departments(),
        fetch_cohorts(cohort_resource_ids),
        fetch_roles(),
        fetch_session(),
    )

    return AuthProfileInternalData(
        identity=identity,
        profile_id=profile_id,
        scoped_roles=scoped_roles,
        departments=departments,
        cohorts=cohorts,
        role_resources=[convert_role(r) for r in roles_raw],
        session_id=session_id,
    )


@router.post("/profile", response_model=GetAuthProfileApiResponse)
async def get_auth_profile(
    request: GetProfileContextApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthProfileApiResponse:
    """Identity + permissions endpoint."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        pass1_start = time.time()

        async def fetch_redirect():
            async with pool.acquire() as c:
                return await resolve_redirect_path(c, profile_id)

        data, redirect_path = await asyncio.gather(
            get_auth_profile_internal(conn, profile_id, bypass_cache),
            fetch_redirect(),
        )
        pass1_time = (time.time() - pass1_start) * 1000

        identity = data.identity

        response.headers["X-Two-Pass"] = "1"
        response.headers["X-Pass1-Time"] = f"{pass1_time:.1f}"

        user_artifacts = identity.role_artifacts or []
        available_routes = compute_available_routes(user_artifacts)
        available_sections = compute_available_sections(user_artifacts)

        return GetAuthProfileApiResponse(
            is_authorized=True,
            id=data.profile_id,
            name=identity.name,
            role=identity.role,
            active=identity.is_active,
            scoped_roles=data.scoped_roles,
            available_sections=available_sections,
            available_routes=available_routes,
            redirect_path=redirect_path,
            role_resources=data.role_resources,
            session_id=data.session_id,
            actor_name=identity.name,
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Cohort list endpoint - v4 API.

Profile/simulation/department mapping hydrated in Python via cached *_internal() functions.
"""

import asyncio
import uuid
from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.cohort.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
    compute_can_leave,
)
from app.api.v4.artifacts.cohort.types import (
    ListCohortApiCohort,
    ListCohortApiDepartment,
    ListCohortApiProfile,
    ListCohortApiResponse,
    ListCohortApiSimulation,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.api.v4.types import ListFilterSection
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetCohortsListApiRequest,
    GetCohortsListSqlParams,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/cohorts/get_cohorts_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListCohortApiResponse,
    dependencies=[
        audit_activity("cohorts.list", "{{ actor.name }} visited the Cohorts page")
    ],
)
async def get_cohort_list(
    request: GetCohortsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListCohortApiResponse:
    """Get cohorts list with permissions and relationships."""
    tags = ["cohorts"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (mode='json' to serialize UUIDs)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListCohortApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
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
                    bypass_cache=bypass_cache,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = "member"

        # Convert API request to SQL params (add profile_id from header)
        params = GetCohortsListSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        )

        # actor_name and user_role already fetched from context above

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Compute permissions in Python for each cohort
        api_cohorts: list[ListCohortApiCohort] = []
        for sql_cohort in result.cohorts or []:
            c = (
                sql_cohort
                if hasattr(sql_cohort, "cohort_id")
                else type("C", (), sql_cohort)()
            )  # type: ignore
            can_edit_val = compute_can_edit(
                user_role=user_role,
                cohort_department_ids=getattr(c, "department_ids", None),
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                cohort_department_ids=getattr(c, "department_ids", None),
                usage_count=getattr(c, "usage_count", 0) or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)
            can_leave_val = compute_can_leave(
                is_member=getattr(c, "is_member", False) or False,
            )

            api_cohorts.append(
                ListCohortApiCohort(
                    cohort_id=getattr(c, "cohort_id", None),
                    name=getattr(c, "name", None),
                    description=getattr(c, "description", None),
                    is_inactive=getattr(c, "is_inactive", None),
                    department_ids=getattr(c, "department_ids", None),
                    profile_ids=getattr(c, "profile_ids", None),
                    simulation_ids=getattr(c, "simulation_ids", None),
                    usage_count=getattr(c, "usage_count", None),
                    num_members=getattr(c, "num_members", None),
                    can_edit=can_edit_val,
                    can_delete=can_delete_val,
                    can_duplicate=can_duplicate_val,
                    can_leave=can_leave_val,
                    updated_at=getattr(c, "updated_at", None),
                )
            )

        # --- Python hydration: profiles, simulations, departments from cached *_internal() ---
        # 1. Collect unique IDs from paginated cohorts
        profile_id_set: set[UUID] = set()
        simulation_id_set: set[UUID] = set()
        department_id_set: set[UUID] = set()

        for cohort in api_cohorts:
            for pid in cohort.profile_ids or []:
                try:
                    profile_id_set.add(UUID(str(pid)))
                except (ValueError, AttributeError):
                    pass
            for sid in cohort.simulation_ids or []:
                try:
                    simulation_id_set.add(UUID(str(sid)))
                except (ValueError, AttributeError):
                    pass
            for did in cohort.department_ids or []:
                try:
                    department_id_set.add(UUID(str(did)))
                except (ValueError, AttributeError):
                    pass

        # 2. Parallel fetch via asyncio.gather + pool connections
        profiles_data = []
        simulations_data = []
        departments_data = []

        pool = get_pool()
        if pool and (profile_id_set or simulation_id_set or department_id_set):

            async def fetch_profiles() -> list:
                if not profile_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_profiles_internal(
                        c, list(profile_id_set), bypass_cache
                    )

            async def fetch_simulations() -> list:
                if not simulation_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_simulations_internal(
                        c, list(simulation_id_set), bypass_cache
                    )

            async def fetch_departments() -> list:
                if not department_id_set:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, list(department_id_set), bypass_cache
                    )

            profiles_data, simulations_data, departments_data = await asyncio.gather(
                fetch_profiles(), fetch_simulations(), fetch_departments()
            )

        # 3. Assemble mapping arrays
        api_profiles: list[ListCohortApiProfile] = [
            ListCohortApiProfile(
                profile_id=p.profile_id,
                name=p.name,
                description=getattr(p, "description", None) or "",
            )
            for p in profiles_data
        ]

        api_simulations: list[ListCohortApiSimulation] = [
            ListCohortApiSimulation(
                simulation_id=s.simulation_id,
                name=getattr(s, "name", None),
                description=s.description,
                department_ids=getattr(s, "department_ids", None),
            )
            for s in simulations_data
        ]

        api_departments: list[ListCohortApiDepartment] = [
            ListCohortApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description,
            )
            for d in departments_data
        ]

        # Build API response
        api_response = ListCohortApiResponse(
            actor_name=actor_name,
            user_role=user_role,
            cohorts=api_cohorts,
            profiles=api_profiles,
            simulations=api_simulations,
            departments=api_departments,
            simulation_filter=ListFilterSection.from_sql_options(
                result.simulation_options,
                request.filter_simulation_ids,
                request.simulation_search,
            ),
            profile_filter=ListFilterSection.from_sql_options(
                result.profile_options,
                request.filter_profile_ids,
                request.profile_search,
            ),
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                request.filter_department_ids,
                request.department_search,
            ),
            total_count=result.total_count,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_cohort_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Agent list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_link_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.agent.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_list_can_edit,
)
from app.api.v4.artifacts.agent.types import (
    ListAgentApiAgent,
    ListAgentApiDepartment,
    ListAgentApiModel,
    ListAgentApiResponse,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.models.get import get_models_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetAgentsListApiRequest,
    GetAgentsListSqlParams,
    GetAgentsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/agents/get_agents_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListAgentApiResponse,
    dependencies=[
        audit_activity("agents.list", "{{ actor.name }} visited the Agents page")
    ],
)
async def get_agent_list(
    request: GetAgentsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListAgentApiResponse:
    """Get list of agents with permissions."""
    tags = ["agents"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListAgentApiResponse.model_validate(cached["data"])

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

        # Fetch user context for audit logging and permissions
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=bypass_cache,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
        else:
            actor_name = None
            user_role = None

        # Convert API request to SQL params (add profile_id from header + request body fields)
        params = GetAgentsListSqlParams(
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            department_search=request.department_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetAgentsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Compute permissions for each agent in Python
        agents_with_permissions: list[ListAgentApiAgent] = []
        for agent in result.agents or []:
            can_edit_val = compute_list_can_edit(
                user_role=user_role,
                agent_department_ids=agent.department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                usage_count=agent.department_link_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            agents_with_permissions.append(
                ListAgentApiAgent(
                    agent_id=agent.agent_id,
                    name=agent.name,
                    description=agent.description,
                    reasoning=agent.reasoning,
                    temperature=agent.temperature,
                    model_id=agent.model_id,
                    role=agent.role,
                    updated_at=agent.updated_at,
                    department_ids=agent.department_ids,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                )
            )

        # --- Python hydration: filter option names from cached *_internal() ---
        # Extract option IDs and counts from SQL result
        department_option_ids = getattr(result, "department_option_ids", None) or []
        model_option_ids = getattr(result, "model_option_ids", None) or []

        # Build ID -> count maps
        department_count_map: dict[UUID, int] = {}
        department_ids_to_fetch: list[UUID] = []
        for opt in department_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                department_count_map[uid] = int(opt_count or 0)
                department_ids_to_fetch.append(uid)

        model_count_map: dict[UUID, int] = {}
        model_ids_to_fetch: list[UUID] = []
        for opt in model_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                model_count_map[uid] = int(opt_count or 0)
                model_ids_to_fetch.append(uid)

        # Also collect model IDs from agents for name hydration
        agent_model_ids: set[UUID] = set()
        for agent in agents_with_permissions:
            if agent.model_id:
                agent_model_ids.add(agent.model_id)
        # Merge with option model IDs
        all_model_ids_to_fetch = list(set(model_ids_to_fetch) | agent_model_ids)

        # Parallel fetch names from cached *_internal() functions
        departments_data = []
        models_data = []

        pool = get_pool()
        has_ids = any([department_ids_to_fetch, all_model_ids_to_fetch])

        if pool and has_ids:

            async def fetch_departments() -> list:
                if not department_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, department_ids_to_fetch, bypass_cache
                    )

            async def fetch_models() -> list:
                if not all_model_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_models_internal(
                        c, all_model_ids_to_fetch, bypass_cache
                    )

            departments_data, models_data = await asyncio.gather(
                fetch_departments(), fetch_models()
            )

        # Build model lookup for agent name hydration
        model_lookup: dict[UUID, tuple[str | None, str | None]] = {}
        for m in models_data:
            m_id = getattr(m, "id", None)
            if m_id:
                uid = UUID(str(m_id)) if not isinstance(m_id, UUID) else m_id
                model_lookup[uid] = (m.name, m.description)

        # Hydrate model_name and model_description on each agent
        for agent in agents_with_permissions:
            if agent.model_id and agent.model_id in model_lookup:
                agent.model_name = model_lookup[agent.model_id][0]
                agent.model_description = model_lookup[agent.model_id][1]

        # Merge names with counts, apply search filtering in Python
        department_search = request.department_search
        departments: list[ListAgentApiDepartment] = [
            ListAgentApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description or "",
                count=department_count_map.get(d.department_id, 0)
                if d.department_id
                else 0,
            )
            for d in departments_data
            if d.department_id
            and (
                department_search is None
                or department_search.lower() in (d.name or "").lower()
            )
        ]

        models: list[ListAgentApiModel] = [
            ListAgentApiModel(
                model_id=UUID(str(m_id)) if not isinstance(m_id, UUID) else m_id,
                name=m.name,
                description=m.description or "",
                count=model_count_map.get(
                    UUID(str(m_id)) if not isinstance(m_id, UUID) else m_id, 0
                ),
            )
            for m in models_data
            if (m_id := getattr(m, "id", None))
            and (UUID(str(m_id)) if not isinstance(m_id, UUID) else m_id)
            in model_count_map
        ]

        # Build API response with computed permissions
        api_response = ListAgentApiResponse(
            actor_name=actor_name,
            agents=agents_with_permissions,
            departments=departments,
            models=models,
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
            operation="get_agent_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

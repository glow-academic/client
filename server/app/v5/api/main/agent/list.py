"""Agent list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_link_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names resolved in SQL via ListFilterSection pattern.
Model names for per-agent display hydrated from cached get_models_internal().
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.agent.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_list_can_edit,
)
from app.v5.api.main.agent.types import (
    ListAgentApiAgent,
    ListAgentApiResponse,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.resources.models.get import get_models_internal
from app.v5.api.types import ListFilterSection
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.sql.types import (
    GetAgentsListApiRequest,
    GetAgentsListSqlParams,
    GetAgentsListSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/v5/sql/queries/agents/get_agents_list_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListAgentApiResponse)
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
            user_role = None

        # Convert API request to SQL params (add profile_id from header + request body fields)
        params = GetAgentsListSqlParams(
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            filter_model_ids=getattr(request, "filter_model_ids", None),
            filter_tool_ids=getattr(request, "filter_tool_ids", None),
            department_search=request.department_search,
            model_search=getattr(request, "model_search", None),
            tool_search=getattr(request, "tool_search", None),
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

        # Compute permissions for each agent in Python
        agents_with_permissions: list[ListAgentApiAgent] = []
        agent_model_ids: set[UUID] = set()
        for agent in result.agents or []:
            can_edit_val = compute_list_can_edit(
                user_role=user_role,
                agent_department_ids=agent.department_ids,
                active_settings_count=agent.active_settings_count or 0,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                active_settings_count=agent.active_settings_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            if agent.model_id:
                agent_model_ids.add(
                    UUID(str(agent.model_id))
                    if not isinstance(agent.model_id, UUID)
                    else agent.model_id
                )

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

        # Hydrate model_name and model_description per agent from cached models
        if pool and agent_model_ids:
            async with pool.acquire() as c:
                models_data = await get_models_internal(
                    c, list(agent_model_ids), bypass_cache
                )
            model_lookup: dict[UUID, tuple[str | None, str | None]] = {}
            for m in models_data:
                m_id = getattr(m, "id", None)
                if m_id:
                    uid = UUID(str(m_id)) if not isinstance(m_id, UUID) else m_id
                    model_lookup[uid] = (m.name, m.description)

            for agent in agents_with_permissions:
                if agent.model_id and agent.model_id in model_lookup:
                    agent.model_name = model_lookup[agent.model_id][0]
                    agent.model_description = model_lookup[agent.model_id][1]

        # Build API response with ListFilterSection pattern
        api_response = ListAgentApiResponse(
            actor_name=actor_name,
            agents=agents_with_permissions,
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                request.filter_department_ids,
                request.department_search,
            ),
            model_filter=ListFilterSection.from_sql_options(
                result.model_options,
                getattr(request, "filter_model_ids", None),
                getattr(request, "model_search", None),
            ),
            tool_filter=ListFilterSection.from_sql_options(
                result.tool_options,
                getattr(request, "filter_tool_ids", None),
                getattr(request, "tool_search", None),
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
            operation="get_agent_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

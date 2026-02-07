"""Agent get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (agent_id = NULL) and detail (agent_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetAgentApiRequest,
    GetAgentApiResponse,
    GetAgentSqlParams,
    GetAgentSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/agents/get_agent_complete.sql"


router = APIRouter()


def _extract_agent_websocket_context(result: GetAgentSqlRow) -> dict[str, Any]:
    """Build minimal generation context payload for websocket consumers."""
    payload = result.model_dump()
    context_keys = (
        "group_id",
        "trace_id",
        "run_id",
        "domains",
        "tools",
        "tool_ids",
        "domain_ids",
        "agent_ids",
        "department_id",
        "provider_id",
        "model_id",
        "resource_group_ids",
        "generation_context",
    )
    return {key: payload.get(key) for key in context_keys if payload.get(key) is not None}


async def get_agent_internal(
    conn: asyncpg.Connection,
    params: GetAgentSqlParams,
) -> GetAgentSqlRow:
    """Internal SQL fetch layer for agent get endpoint."""
    return cast(
        GetAgentSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )


def get_agent_websocket(result: GetAgentSqlRow) -> dict[str, Any]:
    """Websocket wrapper layer for agent generation context."""
    return _extract_agent_websocket_context(result)


def get_agent_client(result: GetAgentSqlRow) -> GetAgentApiResponse:
    """Client/BFF wrapper layer for agent get response."""
    payload = result.model_dump()
    if "generation_context" in payload:
        payload["generation_context"] = get_agent_websocket(result)
    return GetAgentApiResponse.model_validate(payload)


@router.post(
    "/get",
    response_model=GetAgentApiResponse,
    dependencies=[
        audit_activity(
            "agent.get",
            "{{ actor.name }} {% if agent %}viewed{% else %}opened new{% endif %} agent{% if agent %} '{{ agent.name }}'{% endif %}",
        )
    ],
)
async def get_agent(
    request: GetAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAgentApiResponse:
    """Get agent information - handles both new (agent_id = NULL) and detail (agent_id provided).

    Validation Logic:
    - Tools are REQUIRED for resources - error if no tools exist (via missing_tools_check CTE)
    - Agents are OPTIONAL - NULL agent_id means manual entry only (no generate button shown)
    - Frontend components check agent_id before showing generate button
    """
    tags = ["agents"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetAgentApiResponse.model_validate(cached["data"])

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

        # Extract params from API request
        draft_id = request.draft_id
        agent_id = request.agent_id  # Can be NULL for new mode
        descriptions_search = request.descriptions_search
        prompts_search = request.prompts_search
        instructions_search = request.instructions_search

        # Get mcp flag from header (set by router-level dependency)
        mcp = getattr(http_request.state, "mcp", False) or False

        # Convert API request to SQL params (add profile_id and mcp from header)
        params = GetAgentSqlParams(
            agent_id=agent_id,
            profile_id=profile_id,
            descriptions_search=descriptions_search,
            prompts_search=prompts_search,
            instructions_search=instructions_search,
            draft_id=draft_id,
            mcp=mcp,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = await get_agent_internal(conn, params)

        # Set audit context
        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            # Only add agent to audit context if agent_id was provided (detail mode)
            if agent_id and result.name_resource and result.name_resource.name:
                audit_ctx["agent"] = {
                    "name": result.name_resource.name,
                    "id": str(agent_id),
                }
            audit_set(http_request, **audit_ctx)

        # Conditional validation based on mode
        if agent_id is None:
            # New mode: check for valid departments (derive from departments array)
            departments_list = result.departments or []
            valid_department_ids = [
                d.department_id for d in departments_list if d.department_id
            ]
            if not valid_department_ids:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )
        else:
            # Detail mode: check if agent exists and has access
            if result.agent_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Agent {agent_id} not found"
                )

            if not result.name_resource or not result.name_resource.name:
                # Agent exists but user doesn't have access
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this agent. It may be restricted to other departments.",
                )

        # Convert SQL result to API response
        response_data = get_agent_client(result)

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

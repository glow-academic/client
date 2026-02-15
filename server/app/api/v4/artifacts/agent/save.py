"""Agent save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (agent_id = NULL) and update (agent_id provided).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.agent.permissions import (
    compute_can_create,
    compute_can_edit,
    has_access,
)
from app.api.v4.artifacts.agent.types import (
    AgentMultiResourceAction,
    AgentResourceAction,
    SaveAgentApiRequest,
    SaveAgentApiResponse,
    SaveAgentSqlParams,
    SaveAgentSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetAgentAccessSqlParams,
    GetAgentAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# Load SQL with types at module level - makes it clear what SQL file is used
ACCESS_SQL_PATH = "app/sql/v4/queries/agents/get_agent_access_complete.sql"
SQL_PATH = "app/sql/v4/queries/agents/save_agent_complete.sql"


router = APIRouter()


async def save_agent_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None,
    resource_actions: dict[str, Any],
    agent_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save an agent from resource actions dict (used by generation complete handler).

    Builds SaveAgentSqlParams from a flat resource_actions dict, executes the
    save SQL in a transaction, and invalidates cache.

    Returns the agent_id on success, None on failure.
    """
    try:

        def _single(key: str) -> AgentResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return AgentResourceAction(
                    resource_id=val.get("resource_id"),
                )
            return AgentResourceAction()

        def _multi(key: str) -> AgentMultiResourceAction:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return AgentMultiResourceAction(
                    resource_ids=val.get("resource_ids"),
                )
            return AgentMultiResourceAction()

        params = SaveAgentSqlParams(
            profile_id=profile_id,
            input_agent_id=agent_id,
            group_id=group_id,
            names=_single("names"),
            descriptions=_single("descriptions"),
            models=_single("models"),
            prompts=_single("prompts"),
            instructions=_single("instructions"),
            flags=_single("flags"),
            temperature_levels=_single("temperature_levels"),
            reasoning_levels=_single("reasoning_levels"),
            departments=_multi("departments"),
            tools=_multi("tools"),
            voices=_multi("voices"),
        )

        async with conn.transaction():
            result = cast(
                SaveAgentSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.agent_id:
                return None

        await invalidate_tags(["agents"])
        return result.agent_id

    except Exception as e:
        logger.exception(f"save_agent_internal failed: {e}")
        return None


@router.post(
    "/save",
    response_model=SaveAgentApiResponse,
    dependencies=[
        audit_activity(
            "agent.saved",
            "{{ actor.name }} {% if agent %}updated{% else %}created{% endif %} agent{% if agent %} '{{ agent.name }}'{% endif %}",
        )
    ],
)
async def save_agent(
    request: SaveAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveAgentApiResponse:
    """Save agent - handles both create (agent_id = NULL) and update (agent_id provided)."""
    tags = ["agents"]  # From router tags

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

        # Fetch user context for permissions and audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission checks
        if request.input_agent_id:
            # Update mode: check access and save permissions
            access_params = GetAgentAccessSqlParams(
                profile_id=profile_id,
                agent_id=request.input_agent_id,
            )
            access_result = cast(
                GetAgentAccessSqlRow,
                await execute_sql_typed(conn, ACCESS_SQL_PATH, params=access_params),
            )
            if access_result and access_result.agent_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Agent {request.input_agent_id} not found",
                )

            agent_department_ids = (
                getattr(access_result, "agent_department_ids", None) or []
            )
            has_agent_access = has_access(
                user_role, user_department_ids, agent_department_ids
            )

            if not compute_can_edit(
                user_role=user_role,
                has_agent_access=has_agent_access,
                missing_tools=[],
                agent_id=request.input_agent_id,
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to save this agent.",
                )
        else:
            # Create mode: check create permissions
            if not compute_can_create(
                user_role=user_role, user_department_ids=user_department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to create agents.",
                )

        # Server-resolved group_id: create if not updating an existing agent
        group_id = None
        if not request.input_agent_id:
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
            )

        async with conn.transaction():
            # Convert flat resource IDs to SQL params (add profile_id and group_id from server)
            params = SaveAgentSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveAgentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.agent_id:
                if request.input_agent_id:
                    raise ValueError(f"Agent not found: {request.input_agent_id}")
                else:
                    raise ValueError("Failed to create agent")

            # Set audit context with data from SQL query
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                audit_ctx["agent"] = {"id": str(result.agent_id)}
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveAgentApiResponse.model_validate(
            {
                "agent_id": str(result.agent_id),
                "actor_name": actor_name,
            }
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

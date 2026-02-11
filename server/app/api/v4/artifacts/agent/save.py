"""Agent save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (agent_id = NULL) and update (agent_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.agent.types import (
    SaveAgentApiRequest,
    SaveAgentApiResponse,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SaveAgentSqlParams,
    SaveAgentSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/agents/save_agent_complete.sql"


router = APIRouter()


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

        name_id = request.names.resource_id if request.names else None
        model_id = request.models.resource_id if request.models else None
        description_id = (
            request.descriptions.resource_id
            if request.descriptions is not None
            else None
        )
        prompt_id = request.prompts.resource_id if request.prompts is not None else None
        instructions_id = (
            request.instructions.resource_id
            if request.instructions is not None
            else None
        )
        active_flag_id = (
            request.flags.resource_id if request.flags is not None else None
        )
        temperature_level_id = (
            request.temperature_levels.resource_id
            if request.temperature_levels is not None
            else None
        )
        reasoning_level_id = (
            request.reasoning_levels.resource_id
            if request.reasoning_levels is not None
            else None
        )
        department_ids = (
            request.departments.resource_ids
            if request.departments is not None
            else None
        )
        tool_ids = request.tools.resource_ids if request.tools is not None else None
        voice_ids = request.voices.resource_ids if request.voices is not None else None

        # Validate required section actions
        if not name_id:
            raise HTTPException(status_code=400, detail="names.resource_id is required")

        if not model_id:
            raise HTTPException(
                status_code=400, detail="models.resource_id is required"
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = SaveAgentSqlParams(
                profile_id=profile_id,
                group_id=request.group_id,
                input_agent_id=request.input_agent_id,
                name_id=name_id,
                model_id=model_id,
                description_id=description_id,
                prompt_id=prompt_id,
                instructions_id=instructions_id,
                active_flag_id=active_flag_id,
                temperature_level_id=temperature_level_id,
                reasoning_level_id=reasoning_level_id,
                department_ids=department_ids,
                tool_ids=tool_ids,
                voice_ids=voice_ids,
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
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add agent to audit context if input_agent_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use the request name if available
                if request.input_agent_id:
                    # Update mode: use request name (from request body)
                    audit_ctx["agent"] = {
                        "name": str(name_id),
                        "id": str(result.agent_id),
                    }
                else:
                    # Create mode: use request name
                    audit_ctx["agent"] = {
                        "name": str(name_id),
                        "id": str(result.agent_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveAgentApiResponse.model_validate(
            {
                "agent_id": str(result.agent_id),
                "actor_name": result.actor_name,
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

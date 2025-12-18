"""Agent update endpoint."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class UpdateAgentRequest(BaseModel):
    agentId: str
    name: str
    description: str
    prompt_id: str | None
    system_prompt: str
    model_id: str
    active: bool
    role: str
    department_ids: list[str] | None
    department_ids_for_prompt: list[str] | None = None
    # Array of department IDs for prompt overrides (never create default prompts, always department-specific overrides)
    model_temperature_level_id: str | None = None
    model_reasoning_level_id: str | None = None
    model_voice_ids: list[str] | None = None
    # profileId removed - comes from X-Profile-Id header


class UpdateAgentResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateAgentResponse,
    dependencies=[
        audit_activity(
            "agent.updated", "{{ actor.name }} updated agent '{{ agent.name }}'"
        )
    ],
)
async def update_agent(
    request: UpdateAgentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateAgentResponse:
    """Update an agent."""
    tags = ["agents"]  # From router tags

    # Validate model_id is not empty and is a valid UUID
    if not request.model_id or not request.model_id.strip():
        raise HTTPException(
            status_code=400, detail="model_id is required and cannot be empty"
        )

    # Validate model_id is a valid UUID format
    try:
        uuid.UUID(request.model_id.strip())
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=400,
            detail=f"model_id must be a valid UUID, got: {request.model_id!r}",
        ) from None

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []

            # Update agent with prompt and departments in single SQL (DHH style)
            dept_ids_for_prompt = (
                request.department_ids_for_prompt
                if request.department_ids_for_prompt
                else []
            )
            sql_query = load_sql("sql/v3/agents/update_agent_complete.sql")
            sql_params = (
                request.agentId,
                request.name,
                request.description,
                request.model_id,
                request.active,
                request.role,
                request.prompt_id,
                request.system_prompt if not request.prompt_id else None,
                dept_ids,  # Always pass array (empty array if no departments)
                dept_ids_for_prompt,  # Array of department IDs for prompt overrides
                profile_id,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Agent not found: {request.agentId}"
                )

            actor_name = result.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    agent={"name": request.name, "id": request.agentId},
                )

            # Update temperature level if provided
            if request.model_temperature_level_id is not None:
                # Deactivate existing temperature level
                await conn.execute(
                    "UPDATE agent_temperature_levels SET active = false, updated_at = NOW() WHERE agent_id = $1",
                    request.agentId,
                )
                # Insert new temperature level
                if request.model_temperature_level_id:
                    await conn.execute(
                        "INSERT INTO agent_temperature_levels (agent_id, model_temperature_level_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_temperature_level_id) DO UPDATE SET active = true, updated_at = NOW()",
                        request.agentId,
                        request.model_temperature_level_id,
                    )

            # Update reasoning level if provided
            if request.model_reasoning_level_id is not None:
                # Deactivate existing reasoning level
                await conn.execute(
                    "UPDATE agent_reasoning_levels SET active = false, updated_at = NOW() WHERE agent_id = $1",
                    request.agentId,
                )
                # Insert new reasoning level
                if request.model_reasoning_level_id:
                    await conn.execute(
                        "INSERT INTO agent_reasoning_levels (agent_id, model_reasoning_level_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_reasoning_level_id) DO UPDATE SET active = true, updated_at = NOW()",
                        request.agentId,
                        request.model_reasoning_level_id,
                    )

            # Update voices if provided
            if request.model_voice_ids is not None:
                # Deactivate existing voices
                await conn.execute(
                    "UPDATE agent_voices SET active = false, updated_at = NOW() WHERE agent_id = $1",
                    request.agentId,
                )
                # Insert new voices
                for voice_id in request.model_voice_ids:
                    await conn.execute(
                        "INSERT INTO agent_voices (agent_id, model_voice_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_voice_id) DO UPDATE SET active = true, updated_at = NOW()",
                        request.agentId,
                        voice_id,
                    )

        result_data = UpdateAgentResponse(
            success=True, message="Agent updated successfully"
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

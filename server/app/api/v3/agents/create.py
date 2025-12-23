"""Agent create endpoint."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql

# Generated types will be imported after running: make sql-compile
# from app.api.v3.agents.create.types import CreateAgentSqlParams, CreateAgentSqlRow

# Request model for API (includes business logic fields not in SQL)
class CreateAgentRequest(BaseModel):
    name: str
    description: str
    prompt_id: str | None
    system_prompt: str
    model_id: str
    active: bool
    role: str
    department_ids: list[str] | None
    model_temperature_level_id: str | None = None
    model_reasoning_level_id: str | None = None
    model_voice_ids: list[str] | None = None
    # profileId removed - comes from X-Profile-Id header


class CreateAgentResponse(BaseModel):
    success: bool
    agentId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateAgentResponse,
    dependencies=[
        audit_activity(
            "agent.created", "{{ actor.name }} created agent '{{ agent.name }}'"
        )
    ],
)
async def create_agent(
    request: CreateAgentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAgentResponse:
    """Create a new agent."""
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

            # Create agent with prompt and departments in single SQL (DHH style)
            sql_query = load_sql("app/sql/v3/agents/create_agent_complete.sql")
            
            # TODO: Once types are generated, use CreateAgentSqlParams:
            # sql_params_model = CreateAgentSqlParams(
            #     param_1=request.name,
            #     param_2=request.description,
            #     param_3=request.model_id,
            #     param_4=request.active,
            #     param_5=request.role,
            #     param_6=request.prompt_id,
            #     param_7=request.system_prompt if not request.prompt_id else None,
            #     param_8=dept_ids,
            #     param_9=profile_id,
            # )
            # sql_params = sql_params_model.to_tuple()
            
            # For now, use manual tuple (will be replaced after type generation)
            sql_params = (
                request.name,
                request.description,
                request.model_id,
                request.active,
                request.role,
                request.prompt_id,
                request.system_prompt if not request.prompt_id else None,
                dept_ids,  # Always pass array (empty array if no departments)
                profile_id,
            )
            agent_row = await conn.fetchrow(sql_query, *sql_params)

            if not agent_row:
                raise HTTPException(status_code=500, detail="Failed to create agent")

            agent_id = agent_row["agent_id"]
            actor_name = agent_row.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    agent={"name": request.name, "id": agent_id},
                )

            # Handle temperature level if provided
            if request.model_temperature_level_id:
                await conn.execute(
                    "INSERT INTO agent_temperature_levels (agent_id, model_temperature_level_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_temperature_level_id) DO UPDATE SET active = true, updated_at = NOW()",
                    agent_id,
                    request.model_temperature_level_id,
                )

            # Handle reasoning level if provided
            if request.model_reasoning_level_id:
                await conn.execute(
                    "INSERT INTO agent_reasoning_levels (agent_id, model_reasoning_level_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_reasoning_level_id) DO UPDATE SET active = true, updated_at = NOW()",
                    agent_id,
                    request.model_reasoning_level_id,
                )

            # Handle voices if provided
            if request.model_voice_ids:
                for voice_id in request.model_voice_ids:
                    await conn.execute(
                        "INSERT INTO agent_voices (agent_id, model_voice_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_voice_id) DO UPDATE SET active = true, updated_at = NOW()",
                        agent_id,
                        voice_id,
                    )

        result_data = CreateAgentResponse(
            success=True,
            agentId=agent_id,
            message="Agent created successfully",
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
            operation="create_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

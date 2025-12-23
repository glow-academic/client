"""Agent update endpoint."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_api_types, load_sql_query, load_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/update_agent_complete.sql"
UpdateAgentSqlParams, UpdateAgentSqlRow = load_sql_typed(SQL_PATH)
UpdateAgentApiRequest, UpdateAgentApiResponse = load_api_types(SQL_PATH)


# Extended request model with additional fields not in SQL (handled separately)
class UpdateAgentRequest(UpdateAgentApiRequest):
    model_temperature_level_id: str | None = None
    model_reasoning_level_id: str | None = None
    model_voice_ids: list[str] | None = None


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateAgentApiResponse,
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
) -> UpdateAgentApiResponse:
    """Update an agent."""
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

        # Validate model_id is not empty and is a valid UUID
        if not request.model_id or not str(request.model_id).strip():
            raise HTTPException(
                status_code=400, detail="model_id is required and cannot be empty"
            )

        # Validate model_id is a valid UUID format
        try:
            uuid.UUID(str(request.model_id).strip())
        except (ValueError, AttributeError):
            raise HTTPException(
                status_code=400,
                detail=f"model_id must be a valid UUID, got: {request.model_id!r}",
            ) from None

        async with conn.transaction():
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []
            dept_ids_for_prompt = (
                request.department_ids_for_prompt
                if request.department_ids_for_prompt
                else []
            )

            # Convert API request to SQL params (add profile_id from header)
            params = UpdateAgentSqlParams(
                **request.model_dump(),
                department_ids=dept_ids,
                department_ids_for_prompt=dept_ids_for_prompt,
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            )

            agent_id = result.agent_id
            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    agent={"name": request.name, "id": str(request.agent_id)},
                )

            # Update temperature level if provided (additional operations after main query)
            if request.model_temperature_level_id is not None:
                # Deactivate existing temperature level
                await conn.execute(
                    "UPDATE agent_temperature_levels SET active = false, updated_at = NOW() WHERE agent_id = $1",
                    request.agent_id,
                )
                # Insert new temperature level
                if request.model_temperature_level_id:
                    await conn.execute(
                        "INSERT INTO agent_temperature_levels (agent_id, model_temperature_level_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_temperature_level_id) DO UPDATE SET active = true, updated_at = NOW()",
                        request.agent_id,
                        request.model_temperature_level_id,
                    )

            # Update reasoning level if provided
            if request.model_reasoning_level_id is not None:
                # Deactivate existing reasoning level
                await conn.execute(
                    "UPDATE agent_reasoning_levels SET active = false, updated_at = NOW() WHERE agent_id = $1",
                    request.agent_id,
                )
                # Insert new reasoning level
                if request.model_reasoning_level_id:
                    await conn.execute(
                        "INSERT INTO agent_reasoning_levels (agent_id, model_reasoning_level_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_reasoning_level_id) DO UPDATE SET active = true, updated_at = NOW()",
                        request.agent_id,
                        request.model_reasoning_level_id,
                    )

            # Update voices if provided
            if request.model_voice_ids is not None:
                # Deactivate existing voices
                await conn.execute(
                    "UPDATE agent_voices SET active = false, updated_at = NOW() WHERE agent_id = $1",
                    request.agent_id,
                )
                # Insert new voices
                for voice_id in request.model_voice_ids:
                    await conn.execute(
                        "INSERT INTO agent_voices (agent_id, model_voice_id, active) VALUES ($1, $2::uuid, true) ON CONFLICT (agent_id, model_voice_id) DO UPDATE SET active = true, updated_at = NOW()",
                        request.agent_id,
                        voice_id,
                    )

        # Convert SQL result to API response
        api_response = UpdateAgentApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
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

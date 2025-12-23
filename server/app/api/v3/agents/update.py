"""Agent update endpoint."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (UpdateAgentApiRequest, UpdateAgentApiResponse,
                           UpdateAgentSqlParams, UpdateAgentSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/update_agent_complete.sql"


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
            model_voice_ids = request.model_voice_ids if request.model_voice_ids else []

            # Convert API request to SQL params (add profile_id from header)
            # Note: After SQL types are regenerated, UpdateAgentSqlParams will include
            # model_temperature_level_id, model_reasoning_level_id, and model_voice_ids
            request_dict = request.model_dump(exclude={"department_ids", "department_ids_for_prompt", "model_voice_ids"})
            # For now, we'll need to construct params manually since types haven't been regenerated
            # After regeneration, this can be simplified to:
            # params = UpdateAgentSqlParams(
            #     **request_dict,
            #     department_ids=dept_ids,
            #     department_ids_for_prompt=dept_ids_for_prompt,
            #     model_voice_ids=model_voice_ids,
            #     profile_id=profile_id,
            # )
            
            # Temporary: Use load_sql and execute directly until types are regenerated
            from utils.sql_helper import load_sql
            sql_query = load_sql(SQL_PATH)
            sql_params = (
                request.agent_id,
                request.name,
                request.description,
                request.model_id,
                request.active,
                request.role,
                request.prompt_id,
                request.system_prompt or "",
                dept_ids,
                dept_ids_for_prompt,
                uuid.UUID(request.model_temperature_level_id) if request.model_temperature_level_id else None,
                uuid.UUID(request.model_reasoning_level_id) if request.model_reasoning_level_id else None,
                model_voice_ids,
                profile_id,
            )
            
            # Execute query
            rows = await conn.fetch(sql_query, *sql_params)
            if not rows:
                raise HTTPException(status_code=404, detail="Agent not found or update not permitted")
            
            result_dict = dict(rows[0])
            agent_id = result_dict["agent_id"]
            actor_name = result_dict["actor_name"]

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    agent={"name": request.name, "id": str(request.agent_id)},
                )
            
            # Create response from result
            api_response = UpdateAgentApiResponse(
                agent_id=agent_id,
                actor_name=actor_name,
            )

        # Response already created above

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

"""Agent update endpoint."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
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
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool
    role: str
    department_ids: list[str] | None
    department_id: str | None = None
    # Note: department_prompt_id removed - not used in SQL


class UpdateAgentResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateAgentResponse)
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
        )

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with conn.transaction():
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []

            # Update agent with prompt and departments in single SQL (DHH style)
            sql_query = load_sql("sql/v3/agents/update_agent_complete.sql")
            sql_params = (
                request.agentId,
                request.name,
                request.description,
                request.temperature,
                request.model_id,
                request.reasoning,
                request.active,
                request.role,
                request.prompt_id,
                request.system_prompt if not request.prompt_id else None,
                dept_ids,  # Always pass array (empty array if no departments)
                request.department_id,
                # Note: department_prompt_id ($13) is not currently used in SQL
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Agent not found: {request.agentId}"
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

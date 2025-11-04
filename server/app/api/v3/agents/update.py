"""Agent update endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
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
    department_prompt_id: str | None = None


class UpdateAgentResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post("/update")
async def update_agent(
    request: UpdateAgentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateAgentResponse:
    """Update an agent."""
    try:
        async with conn.transaction():
            # Update agent
            update_sql = load_sql("sql/v3/agents/update_agent.sql")
            await conn.execute(
                update_sql,
                request.agentId,
                request.name,
                request.description,
                request.temperature,
                request.model_id,
                request.reasoning,
                request.active,
                request.role,
            )

            # Handle prompt update
            prompt_id = None
            if request.prompt_id:
                prompt_id = request.prompt_id
            elif request.system_prompt:
                # Create new prompt entry
                prompt_sql = load_sql("sql/v3/agents/create_prompt.sql")
                prompt_row = await conn.fetchrow(prompt_sql, request.system_prompt)
                if not prompt_row:
                    raise HTTPException(status_code=500, detail="Failed to create prompt")
                prompt_id = prompt_row["prompt_id"]

            # Handle department-specific prompt or default prompt
            if request.department_id and prompt_id:
                # Update department-specific prompt
                dept_prompt_sql = load_sql(
                    "sql/v3/agents/create_or_update_agent_department_prompt.sql"
                )
                await conn.execute(
                    dept_prompt_sql, request.agentId, request.department_id, prompt_id
                )
            elif prompt_id:
                # Link agent to prompt (default)
                agent_prompt_sql = load_sql("sql/v3/agents/create_agent_prompt.sql")
                await conn.execute(agent_prompt_sql, request.agentId, prompt_id)

            # Replace agent-department links
            delete_sql = load_sql("sql/v3/agents/delete_agent_departments.sql")
            await conn.execute(delete_sql, request.agentId)

            # Insert new department membership links if department_ids provided
            if request.department_ids:
                insert_sql = load_sql("sql/v3/agents/create_agent_departments.sql")
                await conn.execute(insert_sql, request.agentId, request.department_ids)

        return UpdateAgentResponse(success=True, message="Agent updated successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


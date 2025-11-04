"""Agent create endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class CreateAgentRequest(BaseModel):
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


class CreateAgentResponse(BaseModel):
    success: bool
    agentId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateAgentResponse)
async def create_agent(
    request: CreateAgentRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAgentResponse:
    """Create a new agent."""
    tags = ["agents"]  # From router tags
    
    try:
        async with conn.transaction():
            # Create agent
            create_sql = load_sql("sql/v3/agents/create_agent.sql")
            agent_row = await conn.fetchrow(
                create_sql,
                request.name,
                request.description,
                request.temperature,
                request.model_id,
                request.reasoning,
                request.active,
                request.role,
            )

            if not agent_row:
                raise HTTPException(status_code=500, detail="Failed to create agent")

            agent_id = agent_row["agent_id"]

            # Handle prompt creation/linking
            prompt_id = None
            if request.prompt_id:
                prompt_id = request.prompt_id
            elif request.system_prompt:
                # Create new prompt
                prompt_sql = load_sql("sql/v3/agents/create_prompt.sql")
                prompt_row = await conn.fetchrow(prompt_sql, request.system_prompt)
                if not prompt_row:
                    raise HTTPException(status_code=500, detail="Failed to create prompt")
                prompt_id = prompt_row["prompt_id"]

            # Link agent to prompt
            if prompt_id:
                agent_prompt_sql = load_sql("sql/v3/agents/create_agent_prompt.sql")
                await conn.execute(agent_prompt_sql, agent_id, prompt_id)

            # Create agent-department links if department_ids provided
            if request.department_ids:
                dept_sql = load_sql("sql/v3/agents/create_agent_departments.sql")
                await conn.execute(dept_sql, agent_id, request.department_ids)

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
        raise HTTPException(status_code=500, detail=str(e))


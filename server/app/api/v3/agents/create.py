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
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []

            # Create agent with prompt and departments in single SQL (DHH style)
            create_sql = load_sql("sql/v3/agents/create_agent_complete.sql")
            agent_row = await conn.fetchrow(
                create_sql,
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
            )

            if not agent_row:
                raise HTTPException(status_code=500, detail="Failed to create agent")

            agent_id = agent_row["agent_id"]

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


"""Agent duplicate endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class DuplicateAgentRequest(BaseModel):
    agentId: str


class DuplicateAgentResponse(BaseModel):
    success: bool
    agentId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateAgentResponse)
async def duplicate_agent(
    request: DuplicateAgentRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateAgentResponse:
    """Duplicate an agent."""
    tags = ["agents"]  # From router tags
    
    try:
        sql = load_sql("sql/v3/agents/duplicate_agent.sql")
        new_agent_row = await conn.fetchrow(sql, request.agentId)

        if not new_agent_row:
            raise HTTPException(status_code=500, detail="Failed to duplicate agent")

        result_data = DuplicateAgentResponse(
            success=True,
            agentId=new_agent_row["agent_id"],
            message="Agent duplicated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


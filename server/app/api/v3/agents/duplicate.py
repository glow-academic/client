"""Agent duplicate endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class DuplicateAgentRequest(BaseModel):
    agentId: str


class DuplicateAgentResponse(BaseModel):
    success: bool
    agentId: str
    message: str


router = APIRouter()


@router.post("/duplicate")
async def duplicate_agent(
    request: DuplicateAgentRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateAgentResponse:
    """Duplicate an agent."""
    try:
        sql = load_sql("sql/v3/agents/duplicate_agent.sql")
        new_agent_row = await conn.fetchrow(sql, request.agentId)

        if not new_agent_row:
            raise HTTPException(status_code=500, detail="Failed to duplicate agent")

        return DuplicateAgentResponse(
            success=True,
            agentId=new_agent_row["agent_id"],
            message="Agent duplicated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


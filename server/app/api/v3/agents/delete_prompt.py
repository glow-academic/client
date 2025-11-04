"""Agent delete prompt endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class DeleteAgentPromptRequest(BaseModel):
    agentId: str
    promptId: str
    departmentId: str | None = None


class DeleteAgentPromptResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post("/delete-prompt")
async def delete_agent_prompt(
    request: DeleteAgentPromptRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAgentPromptResponse:
    """Delete an agent prompt."""
    try:
        sql = load_sql("sql/v3/agents/delete_agent_prompt.sql")
        await conn.execute(sql, request.agentId, request.promptId, request.departmentId)

        return DeleteAgentPromptResponse(
            success=True, message="Prompt deleted successfully"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


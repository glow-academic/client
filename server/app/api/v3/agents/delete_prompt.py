"""Agent delete prompt endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class DeleteAgentPromptRequest(BaseModel):
    agentId: str
    promptId: str
    departmentId: str | None = None


class DeleteAgentPromptResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post("/delete-prompt", response_model=DeleteAgentPromptResponse)
async def delete_agent_prompt(
    request: DeleteAgentPromptRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAgentPromptResponse:
    """Delete an agent prompt."""
    tags = ["agents"]  # From router tags
    
    try:
        sql = load_sql("sql/v3/agents/delete_agent_prompt.sql")
        await conn.execute(sql, request.agentId, request.promptId, request.departmentId)

        result_data = DeleteAgentPromptResponse(
            success=True, message="Prompt deleted successfully"
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


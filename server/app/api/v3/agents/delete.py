"""Agent delete endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class DeleteAgentRequest(BaseModel):
    agentId: str


class DeleteAgentResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteAgentResponse)
async def delete_agent(
    request: DeleteAgentRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAgentResponse:
    """Delete an agent."""
    tags = ["agents"]  # From router tags
    
    try:
        # Check usage first
        usage_sql = load_sql("sql/v3/agents/check_agent_usage.sql")
        usage_result = await conn.fetchrow(usage_sql, request.agentId)
        if usage_result and usage_result["usage_count"] > 0:
            raise HTTPException(
                status_code=400, detail="Cannot delete agent: agent is in use"
            )

        # Delete agent
        delete_sql = load_sql("sql/v3/agents/delete_agent.sql")
        await conn.execute(delete_sql, request.agentId)

        result_data = DeleteAgentResponse(success=True, message="Agent deleted successfully")
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


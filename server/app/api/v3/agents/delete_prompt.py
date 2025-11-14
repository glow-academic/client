"""Agent delete prompt endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAgentPromptResponse:
    """Delete an agent prompt."""
    tags = ["agents"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/agents/delete_agent_prompt.sql")
        sql_params = (request.agentId, request.promptId, request.departmentId)
        await conn.execute(sql_query, request.agentId, request.promptId, request.departmentId)

        result_data = DeleteAgentPromptResponse(
            success=True, message="Prompt deleted successfully"
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_agent_prompt",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


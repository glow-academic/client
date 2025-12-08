"""Agent duplicate endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicateAgentRequest(BaseModel):
    agentId: str
    profileId: str  # Required for auditing/access control


class DuplicateAgentResponse(BaseModel):
    success: bool
    agentId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateAgentResponse)
async def duplicate_agent(
    request: DuplicateAgentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateAgentResponse:
    """Duplicate an agent."""
    tags = ["agents"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/agents/duplicate_agent.sql")
        sql_params = (request.agentId, request.profileId)
        new_agent_row = await conn.fetchrow(
            sql_query, request.agentId, request.profileId
        )

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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

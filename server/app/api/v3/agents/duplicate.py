"""Agent duplicate endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicateAgentRequest(BaseModel):
    agentId: str
    # profileId removed - comes from X-Profile-Id header


class DuplicateAgentResponse(BaseModel):
    success: bool
    agentId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateAgentResponse,
    dependencies=[
        audit_activity(
            "agent.duplicated", "{{ actor.name }} duplicated agent '{{ agent.name }}'"
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("sql/v3/agents/duplicate_agent.sql")
        sql_params = (request.agentId, profile_id)
        new_agent_row = await conn.fetchrow(sql_query, request.agentId, profile_id)

        if not new_agent_row:
            raise HTTPException(status_code=500, detail="Failed to duplicate agent")

        agent_id = new_agent_row["agent_id"]
        actor_name = new_agent_row.get("actor_name")
        agent_name = new_agent_row.get("agent_name")

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                agent={"name": agent_name, "id": agent_id},
            )

        result_data = DuplicateAgentResponse(
            success=True,
            agentId=agent_id,
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

"""Agent delete endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline request/response schemas
class DeleteAgentRequest(BaseModel):
    agentId: str
    # profileId removed - comes from X-Profile-Id header


class DeleteAgentResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteAgentResponse,
    dependencies=[
        audit_activity(
            "agent.deleted", "{{ actor.name }} deleted agent '{{ agent.name }}'"
        )
    ],
)
async def delete_agent(
    request: DeleteAgentRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAgentResponse:
    """Delete an agent."""
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

        # Delete agent with usage check (single query)
        sql_query = load_sql("app/sql/v3/agents/delete_agent_complete.sql")
        sql_params = (request.agentId, profile_id)
        result = await conn.fetchrow(sql_query, request.agentId, profile_id)

        if result and result["usage_count"] > 0:
            raise HTTPException(
                status_code=400, detail="Cannot delete agent: agent is in use"
            )

        # Set audit context with data from SQL query
        actor_name = result.get("actor_name") if result else None
        agent_name = result.get("name", "Unknown") if result else "Unknown"
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                agent={"name": agent_name, "id": request.agentId},
            )

        # Note: DELETE is idempotent - deleting non-existent entity is considered success

        result_data = DeleteAgentResponse(
            success=True, message="Agent deleted successfully"
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
            operation="delete_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Agent delete prompt endpoint."""

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
class DeleteAgentPromptRequest(BaseModel):
    agentId: str
    promptId: str
    departmentId: str | None = None


class DeleteAgentPromptResponse(BaseModel):
    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteAgentPromptResponse,
    dependencies=[
        audit_activity(
            "prompt.deleted", "{{ actor.name }} deleted prompt '{{ prompt.name }}'"
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/agents/delete_agent_prompt.sql")
        sql_params = (
            request.agentId,
            request.promptId,
            request.departmentId,
            profile_id,
        )
        result = await conn.fetchrow(
            sql_query,
            request.agentId,
            request.promptId,
            request.departmentId,
            profile_id,
        )

        # Set audit context
        if result:
            prompt_name = result.get("prompt_name", "Unknown")
            actor_name = result.get("actor_name")
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    prompt={"name": prompt_name, "id": request.promptId},
                )

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
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_agent_prompt",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

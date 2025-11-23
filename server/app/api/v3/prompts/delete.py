"""Prompts delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeletePromptRequest(BaseModel):
    """Request to delete prompt."""

    promptId: str
    profileId: str  # Required for auditing/access control


class DeletePromptResponse(BaseModel):
    """Response from delete prompt."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeletePromptResponse)
async def delete_prompt(
    request: DeletePromptRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePromptResponse:
    """Delete a prompt."""
    tags = ["prompts"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Check if prompt is in use by agents or personas
            in_use_check = await conn.fetchrow(
                """
                SELECT 
                    EXISTS(SELECT 1 FROM agent_prompts WHERE prompt_id = $1 AND active = true) as in_agents,
                    EXISTS(SELECT 1 FROM persona_prompts WHERE prompt_id = $1 AND active = true) as in_personas
                """,
                request.promptId,
            )

            if in_use_check and (
                in_use_check["in_agents"] or in_use_check["in_personas"]
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Cannot delete prompt: it is currently in use by agents or personas. Please remove the prompt from all agents and personas first.",
                )

            # Delete prompt (CASCADE will handle prompt_departments)
            sql_query = "DELETE FROM prompts WHERE id = $1::uuid RETURNING id"
            sql_params = (request.promptId, request.profileId)
            result = await conn.fetchrow(sql_query, request.promptId, request.profileId)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Prompt not found: {request.promptId}"
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return DeletePromptResponse(
            success=True,
            message="Prompt deleted successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_prompt",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


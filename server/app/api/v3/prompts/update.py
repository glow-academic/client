"""Prompts update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class UpdatePromptRequest(BaseModel):
    """Request to update prompt."""

    promptId: str
    system_prompt: str
    department_ids: list[str] | None = None


class UpdatePromptResponse(BaseModel):
    """Response from update prompt."""

    success: bool
    promptId: str
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdatePromptResponse)
async def update_prompt(
    request: UpdatePromptRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdatePromptResponse:
    """Update an existing prompt."""
    tags = ["prompts"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Validate system_prompt is not empty
            if not request.system_prompt or not request.system_prompt.strip():
                raise ValueError("System prompt cannot be empty")

            # Check if prompt exists and user has permission to edit
            # This check should be done via the detail endpoint first, but we'll do a basic check here
            prompt_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM prompts WHERE id = $1)",
                request.promptId,
            )
            if not prompt_exists:
                raise HTTPException(
                    status_code=404, detail=f"Prompt not found: {request.promptId}"
                )

            # Ensure department_ids is always an array (empty if None)
            department_ids = request.department_ids if request.department_ids else []

            # Update prompt with department links
            sql_query = load_sql("sql/v3/prompts/update_prompt.sql")
            sql_params = (request.promptId, request.system_prompt, department_ids)
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Prompt not found: {request.promptId}"
                )

            prompt_id = result["prompt_id"]

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UpdatePromptResponse(
            success=True,
            promptId=prompt_id,
            message="Prompt updated successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_prompt",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


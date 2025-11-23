"""Prompts create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreatePromptRequest(BaseModel):
    """Request to create prompt."""

    name: str
    description: str
    system_prompt: str
    active: bool = True
    department_ids: list[str] | None = None
    profileId: str  # Required for auditing/access control


class CreatePromptResponse(BaseModel):
    """Response from create prompt."""

    success: bool
    promptId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreatePromptResponse)
async def create_prompt(
    request: CreatePromptRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreatePromptResponse:
    """Create a new prompt."""
    tags = ["prompts"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Validate system_prompt is not empty
            if not request.system_prompt or not request.system_prompt.strip():
                raise ValueError("System prompt cannot be empty")

            # Ensure department_ids is always an array (empty if None)
            department_ids = request.department_ids if request.department_ids else []

            # Create prompt with department links
            sql_query = load_sql("sql/v3/prompts/create_prompt.sql")
            sql_params = (request.name, request.description, request.system_prompt, request.active, department_ids, request.profileId)
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to create prompt")

            prompt_id = result["prompt_id"]

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreatePromptResponse(
            success=True,
            promptId=prompt_id,
            message="Prompt created successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_prompt",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


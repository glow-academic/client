"""Persona delete prompt endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeletePersonaPromptRequest(BaseModel):
    """Request to delete persona prompt."""

    personaId: str
    promptId: str
    departmentId: str | None = None


class DeletePersonaPromptResponse(BaseModel):
    """Response from delete persona prompt."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete-prompt", response_model=DeletePersonaPromptResponse)
async def delete_persona_prompt(
    request: DeletePersonaPromptRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaPromptResponse:
    """Delete a persona prompt."""
    tags = ["personas"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            sql_query = load_sql("sql/v3/personas/delete_persona_prompt.sql")
            sql_params = (request.personaId, request.promptId, request.departmentId)
            await conn.execute(
                sql_query, request.personaId, request.promptId, request.departmentId
            )

            result_data = DeletePersonaPromptResponse(
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
            operation="delete_persona_prompt",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

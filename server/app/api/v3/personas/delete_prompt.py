"""Persona delete prompt endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaPromptResponse:
    """Delete a persona prompt."""
    tags = ["personas"]  # From router tags
    
    try:
        async with transaction(conn):
            sql = load_sql("sql/v3/personas/delete_persona_prompt.sql")
            await conn.execute(sql, request.personaId, request.promptId, request.departmentId)

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
        raise HTTPException(status_code=500, detail=str(e))


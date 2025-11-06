"""Persona update endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class UpdatePersonaRequest(BaseModel):
    """Request to update persona."""

    personaId: str
    name: str
    description: str | None
    department_ids: list[str] | None
    active: bool
    color: str
    icon: str
    model_id: str
    reasoning: str | None
    temperature: float
    system_prompt: str | None
    prompt_id: str | None
    department_id: str | None  # For department-specific prompts


class UpdatePersonaResponse(BaseModel):
    """Response from update persona."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdatePersonaResponse)
async def update_persona(
    request: UpdatePersonaRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdatePersonaResponse:
    """Update an existing persona."""
    tags = ["personas"]  # From router tags
    
    try:
        async with transaction(conn):
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []
            
            # Convert description None to empty string
            description = request.description if request.description is not None else ""

            # Update persona with prompt and departments in single SQL (DHH style)
            update_sql = load_sql("sql/v3/personas/update_persona_complete.sql")
            result = await conn.fetchrow(
                update_sql,
                request.personaId,
                request.name,
                description,
                request.active,
                request.color,
                request.icon,
                request.model_id,
                request.reasoning,
                request.temperature,
                request.prompt_id,
                request.system_prompt if not request.prompt_id else None,
                dept_ids,  # Always pass array (empty array if no departments)
                request.department_id,
            )

            if not result:
                raise ValueError(f"Persona not found: {request.personaId}")

        result_data = UpdatePersonaResponse(
            success=True,
            message=f"Persona '{request.name}' updated successfully",
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


"""Persona create endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class CreatePersonaRequest(BaseModel):
    """Request to create a persona."""

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


class CreatePersonaResponse(BaseModel):
    """Response from create persona."""

    success: bool
    personaId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreatePersonaResponse)
async def create_persona(
    request: CreatePersonaRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreatePersonaResponse:
    """Create a new persona."""
    tags = ["personas"]  # From router tags
    
    try:
        async with transaction(conn):
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []
            
            # Convert description None to empty string
            description = request.description if request.description is not None else ""

            # Create persona with prompt and departments in single SQL (DHH style)
            create_sql = load_sql("sql/v3/personas/create_persona_complete.sql")
            result = await conn.fetchrow(
                create_sql,
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
            )

            if not result:
                raise ValueError("Failed to create persona")

            persona_id = result["persona_id"]

        result_data = CreatePersonaResponse(
            success=True,
            personaId=persona_id,
            message=f"Persona '{request.name}' created successfully",
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


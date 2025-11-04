"""Persona create endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreatePersonaResponse:
    """Create a new persona."""
    try:
        async with transaction(conn):
            # Create persona
            create_sql = load_sql("sql/v3/personas/create_persona.sql")
            result = await conn.fetchrow(
                create_sql,
                request.name,
                request.description,
                request.active,
                request.color,
                request.icon,
                request.model_id,
                request.reasoning or "none",
                request.temperature,
            )

            if not result:
                raise ValueError("Failed to create persona")

            persona_id = str(result["id"])

            # Handle prompt creation/linking
            prompt_id = None
            if request.prompt_id:
                # Use existing prompt
                prompt_id = request.prompt_id
            elif request.system_prompt:
                # Create new prompt
                prompt_sql = load_sql("sql/v3/personas/create_prompt.sql")
                prompt_row = await conn.fetchrow(prompt_sql, request.system_prompt)
                if not prompt_row:
                    raise ValueError("Failed to create prompt")
                prompt_id = prompt_row["prompt_id"]

            # Link persona to prompt
            if prompt_id:
                persona_prompt_sql = load_sql("sql/v3/personas/create_persona_prompt.sql")
                await conn.execute(persona_prompt_sql, persona_id, prompt_id)

            # Insert department links if department_ids provided
            if request.department_ids:
                dept_sql = load_sql("sql/v3/personas/create_persona_departments.sql")
                await conn.execute(dept_sql, persona_id, request.department_ids)

            return CreatePersonaResponse(
                success=True,
                personaId=persona_id,
                message=f"Persona '{request.name}' created successfully",
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


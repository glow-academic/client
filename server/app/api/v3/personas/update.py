"""Persona update endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdatePersonaResponse:
    """Update an existing persona."""
    try:
        async with transaction(conn):
            # Check if persona exists
            get_name_sql = load_sql("sql/v3/personas/get_persona_name.sql")
            existing = await conn.fetchrow(get_name_sql, request.personaId)

            if not existing:
                raise ValueError(f"Persona not found: {request.personaId}")

            # Update persona
            update_sql = load_sql("sql/v3/personas/update_persona.sql")
            await conn.execute(
                update_sql,
                request.personaId,
                request.name,
                request.description,
                request.active,
                request.color,
                request.icon,
                request.model_id,
                request.reasoning or "none",
                request.temperature,
            )

            # Handle prompt update
            prompt_id = None
            if request.prompt_id:
                prompt_id = request.prompt_id
            elif request.system_prompt:
                # Create new prompt entry
                prompt_sql = load_sql("sql/v3/personas/create_prompt.sql")
                prompt_row = await conn.fetchrow(prompt_sql, request.system_prompt)
                if not prompt_row:
                    raise ValueError("Failed to create prompt")
                prompt_id = prompt_row["prompt_id"]

            # Handle department-specific prompt or default prompt
            if request.department_id and prompt_id:
                # Update department-specific prompt
                dept_prompt_sql = load_sql(
                    "sql/v3/personas/create_or_update_persona_department_prompt.sql"
                )
                await conn.execute(
                    dept_prompt_sql, request.personaId, request.department_id, prompt_id
                )
            elif prompt_id:
                # Link persona to prompt (default prompt)
                persona_prompt_sql = load_sql("sql/v3/personas/create_persona_prompt.sql")
                await conn.execute(persona_prompt_sql, request.personaId, prompt_id)

            # Update persona-department links
            # First deactivate all existing
            delete_dept_sql = load_sql("sql/v3/personas/delete_persona_departments.sql")
            await conn.execute(delete_dept_sql, request.personaId)

            # Then insert new ones if provided
            if request.department_ids:
                create_dept_sql = load_sql("sql/v3/personas/create_persona_departments.sql")
                await conn.execute(create_dept_sql, request.personaId, request.department_ids)

            return UpdatePersonaResponse(
                success=True,
                message=f"Persona '{request.name}' updated successfully",
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


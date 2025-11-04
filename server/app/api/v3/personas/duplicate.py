"""Persona duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class DuplicatePersonaRequest(BaseModel):
    """Request to duplicate persona."""

    personaId: str


class DuplicatePersonaResponse(BaseModel):
    """Response from duplicate persona."""

    success: bool
    personaId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicatePersonaResponse)
async def duplicate_persona(
    request: DuplicatePersonaRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicatePersonaResponse:
    """Duplicate a persona."""
    try:
        async with transaction(conn):
            # Get original persona data
            get_sql = load_sql("sql/v3/personas/get_persona_for_duplicate.sql")
            result = await conn.fetchrow(get_sql, request.personaId)

            if not result:
                raise ValueError(f"Persona not found: {request.personaId}")

            # Duplicate persona
            duplicate_sql = load_sql("sql/v3/personas/insert_duplicate_persona.sql")
            new_persona = await conn.fetchrow(
                duplicate_sql,
                result["name"],
                result["description"],
                result["temperature"],
                result["reasoning"] or "none",
                result["model_id"],
                result["color"],
                result["icon"],
            )

            if not new_persona:
                raise ValueError("Failed to create duplicate persona")

            persona_id = str(new_persona["id"])

            # Create new prompt from original persona's prompt
            if result["system_prompt"]:
                prompt_sql = load_sql("sql/v3/personas/create_prompt.sql")
                prompt_row = await conn.fetchrow(prompt_sql, result["system_prompt"])
                if prompt_row:
                    prompt_id = prompt_row["prompt_id"]
                    # Link persona to prompt
                    persona_prompt_sql = load_sql("sql/v3/personas/create_persona_prompt.sql")
                    await conn.execute(persona_prompt_sql, persona_id, prompt_id)

            return DuplicatePersonaResponse(
                success=True,
                personaId=persona_id,
                message=f"Persona '{result['name']}' duplicated successfully",
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


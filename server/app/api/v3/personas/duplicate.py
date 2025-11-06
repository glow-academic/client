"""Persona duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicatePersonaResponse:
    """Duplicate a persona."""
    tags = ["personas"]  # From router tags
    
    try:
        async with transaction(conn):
            # Get original persona data
            get_sql = load_sql("sql/v3/personas/get_persona_for_duplicate.sql")
            result = await conn.fetchrow(get_sql, request.personaId)

            if not result:
                raise ValueError(f"Persona not found: {request.personaId}")

            # Duplicate persona with prompt and departments in single SQL (DHH style)
            # The SQL will automatically copy department links from the original persona
            duplicate_sql = load_sql("sql/v3/personas/duplicate_persona_complete.sql")
            new_persona = await conn.fetchrow(
                duplicate_sql,
                request.personaId,  # Original persona ID for copying departments
                result["name"],
                result["description"],
                result["temperature"],
                result["reasoning"] or "none",
                result["model_id"],
                result["color"],
                result["icon"],
                result["system_prompt"] or None,
            )

            if not new_persona:
                raise ValueError("Failed to create duplicate persona")

            persona_id = new_persona["persona_id"]

            result_data = DuplicatePersonaResponse(
                success=True,
                personaId=persona_id,
                message=f"Persona '{result['name']}' duplicated successfully",
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


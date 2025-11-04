"""Persona delete endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class DeletePersonaRequest(BaseModel):
    """Request to delete persona."""

    personaId: str


class DeletePersonaResponse(BaseModel):
    """Response from delete persona."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeletePersonaResponse)
async def delete_persona(
    request: DeletePersonaRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaResponse:
    """Delete a persona."""
    try:
        async with transaction(conn):
            # Check if persona is in use
            check_usage_sql = load_sql("sql/v3/personas/check_persona_usage.sql")
            usage = await conn.fetchrow(check_usage_sql, request.personaId)

            if not usage:
                raise ValueError("Failed to check persona usage")

            usage_count = usage.get("usage_count", 0)
            if usage_count > 0:
                raise ValueError("Cannot delete persona that is in use by scenarios")

            # Get persona name
            get_name_sql = load_sql("sql/v3/personas/get_persona_name.sql")
            persona = await conn.fetchrow(get_name_sql, request.personaId)

            if not persona:
                raise ValueError(f"Persona not found: {request.personaId}")

            # Delete persona
            delete_sql = load_sql("sql/v3/personas/delete_persona.sql")
            await conn.execute(delete_sql, request.personaId)

            return DeletePersonaResponse(
                success=True,
                message=f"Persona '{persona['name']}' deleted successfully",
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


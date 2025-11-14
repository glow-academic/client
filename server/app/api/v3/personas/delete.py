"""Persona delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.error_handler import handle_route_error
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
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaResponse:
    """Delete a persona."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
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

            # Delete persona (track primary operation)
            sql_query = load_sql("sql/v3/personas/delete_persona.sql")
            sql_params = (request.personaId,)
            await conn.execute(sql_query, request.personaId)

            return DeletePersonaResponse(
                success=True,
                message=f"Persona '{persona['name']}' deleted successfully",
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


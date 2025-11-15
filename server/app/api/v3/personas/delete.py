"""Persona delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.error.handle_route_error import handle_route_error
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
            # Delete persona with usage check and name fetch (single query)
            sql_query = load_sql("sql/v3/personas/delete_persona_complete.sql")
            sql_params = (request.personaId,)
            result = await conn.fetchrow(sql_query, request.personaId)

            if not result:
                raise ValueError("Failed to check persona usage")

            usage_count = result.get("usage_count", 0)
            if usage_count > 0:
                raise ValueError("Cannot delete persona that is in use by scenarios")

            if not result.get("deleted"):
                raise ValueError(f"Persona not found: {request.personaId}")

            persona_name = result.get("name", "Unknown")
            return DeletePersonaResponse(
                success=True,
                message=f"Persona '{persona_name}' deleted successfully",
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

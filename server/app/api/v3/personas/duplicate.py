"""Persona duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicatePersonaResponse:
    """Duplicate a persona."""
    tags = ["personas"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Get original persona data
            get_sql = load_sql("sql/v3/personas/get_persona_for_duplicate.sql")
            result = await conn.fetchrow(get_sql, request.personaId)

            if not result:
                raise ValueError(f"Persona not found: {request.personaId}")

            # Duplicate persona with prompt and departments in single SQL (DHH style)
            # The SQL will automatically copy department links from the original persona
            sql_query = load_sql("sql/v3/personas/duplicate_persona_complete.sql")
            sql_params = (
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
            new_persona = await conn.fetchrow(sql_query, *sql_params)

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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


"""Persona update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
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
    instructions: str
    text_agent_id: str | None
    voice_agent_id: str | None
    profileId: str  # Required for auditing/access control


class UpdatePersonaResponse(BaseModel):
    """Response from update persona."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdatePersonaResponse)
async def update_persona(
    request: UpdatePersonaRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdatePersonaResponse:
    """Update an existing persona."""
    tags = ["personas"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Validate: at least one agent must be provided
            if not request.text_agent_id and not request.voice_agent_id:
                raise ValueError("At least one agent (text or voice) must be provided")
            
            # Validate agents exist and have correct role
            if request.text_agent_id:
                text_agent = await conn.fetchrow(
                    "SELECT role FROM agents WHERE id = $1 AND active = true",
                    request.text_agent_id,
                )
                if not text_agent:
                    raise ValueError(f"Text agent not found: {request.text_agent_id}")
                if text_agent["role"] != "simulation-text":
                    raise ValueError(f"Agent {request.text_agent_id} is not a simulation-text agent")
            
            if request.voice_agent_id:
                voice_agent = await conn.fetchrow(
                    "SELECT role FROM agents WHERE id = $1 AND active = true",
                    request.voice_agent_id,
                )
                if not voice_agent:
                    raise ValueError(f"Voice agent not found: {request.voice_agent_id}")
                if voice_agent["role"] != "simulation-voice":
                    raise ValueError(f"Agent {request.voice_agent_id} is not a simulation-voice agent")
            
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []

            # Convert description None to empty string
            description = request.description if request.description is not None else ""
            
            # Convert instructions None to empty string
            instructions = request.instructions if request.instructions is not None else ""
            
            # Convert empty strings to None for agent IDs (PostgreSQL expects NULL, not empty string)
            text_agent_id = request.text_agent_id if request.text_agent_id else None
            voice_agent_id = request.voice_agent_id if request.voice_agent_id else None

            # Update persona with agents and departments in single SQL (DHH style)
            sql_query = load_sql("sql/v3/personas/update_persona_complete.sql")
            sql_params = (
                request.personaId,
                request.name,
                description,
                request.active,
                request.color,
                request.icon,
                instructions,
                text_agent_id,
                voice_agent_id,
                dept_ids,  # Always pass array (empty array if no departments)
                request.profileId,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

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
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

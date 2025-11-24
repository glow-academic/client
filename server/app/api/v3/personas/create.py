"""Persona create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
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
    text_model_id: str | None
    audio_model_id: str | None
    voice: str | None
    reasoning: str | None
    temperature: float
    system_prompt: str | None
    prompt_id: str | None
    profileId: str  # Required for auditing/access control


class CreatePersonaResponse(BaseModel):
    """Response from create persona."""

    success: bool
    personaId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreatePersonaResponse)
async def create_persona(
    request: CreatePersonaRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreatePersonaResponse:
    """Create a new persona."""
    tags = ["personas"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Validate: at least one model must be provided
            if not request.text_model_id and not request.audio_model_id:
                raise ValueError("At least one model (text or audio) must be provided")
            
            # Validate: if audio_model_id is provided, voice must also be provided
            if request.audio_model_id and not request.voice:
                raise ValueError("Voice is required when audio_model_id is provided")
            
            # Validate: if voice is provided, audio_model_id must also be provided
            if request.voice and not request.audio_model_id:
                raise ValueError("audio_model_id is required when voice is provided")
            
            # Validate models exist and have correct type
            if request.text_model_id:
                text_model = await conn.fetchrow(
                    "SELECT model_type FROM models WHERE id = $1 AND active = true",
                    request.text_model_id,
                )
                if not text_model:
                    raise ValueError(f"Text model not found: {request.text_model_id}")
                if text_model["model_type"] != "text":
                    raise ValueError(f"Model {request.text_model_id} is not a text model")
            
            if request.audio_model_id:
                audio_model = await conn.fetchrow(
                    "SELECT model_type FROM models WHERE id = $1 AND active = true",
                    request.audio_model_id,
                )
                if not audio_model:
                    raise ValueError(f"Audio model not found: {request.audio_model_id}")
                if audio_model["model_type"] != "audio":
                    raise ValueError(f"Model {request.audio_model_id} is not an audio model")
            
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []

            # Convert description None to empty string
            description = request.description if request.description is not None else ""

            # Create persona with prompt and departments in single SQL (DHH style)
            sql_query = load_sql("sql/v3/personas/create_persona_complete.sql")
            sql_params = (
                request.name,
                description,
                request.active,
                request.color,
                request.icon,
                request.text_model_id,
                request.audio_model_id,
                request.voice,
                request.reasoning,
                request.temperature,
                request.prompt_id,
                request.system_prompt if not request.prompt_id else None,
                dept_ids,  # Always pass array (empty array if no departments)
                request.profileId,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

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
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

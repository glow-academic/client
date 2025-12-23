"""Persona update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


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
    parameter_ids: list[str] | None
    example_ids: list[str] | None
    # profileId removed - comes from X-Profile-Id header


class UpdatePersonaResponse(BaseModel):
    """Response from update persona."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdatePersonaResponse,
    dependencies=[
        audit_activity(
            "persona.updated", "{{ actor.name }} updated persona '{{ persona.name }}'"
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Ensure department_ids is always an array (empty array if None)
            dept_ids = request.department_ids if request.department_ids else []

            # Ensure example_ids is always an array (empty array if None)
            example_ids = request.example_ids if request.example_ids else []

            # Convert description None to empty string
            description = request.description if request.description is not None else ""

            # Convert instructions None to empty string
            instructions = (
                request.instructions if request.instructions is not None else ""
            )

            # Update persona with departments in single SQL (DHH style)
            sql_query = load_sql("app/sql/v3/personas/update_persona_complete.sql")
            sql_params = (
                request.personaId,
                request.name,
                description,
                request.active,
                request.color,
                request.icon,
                instructions,
                dept_ids,  # Always pass array (empty array if no departments)
                profile_id,
                example_ids,  # Always pass array (empty array if no examples)
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError(f"Persona not found: {request.personaId}")

            persona_id = result["persona_id"]
            actor_name = result["actor_name"]  # From SQL query

            # Set audit context with data from SQL query
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                persona={"name": request.name, "id": persona_id},
            )

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

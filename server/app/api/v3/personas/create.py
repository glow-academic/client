"""Persona create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class CreatePersonaRequest(BaseModel):
    """Request to create a persona."""

    name: str
    description: str | None
    department_ids: list[str] | None
    active: bool
    color: str
    icon: str
    instructions: str
    parameter_ids: list[str] | None
    example_ids: list[str] | None
    profileId: str  # Required for auditing/access control


class CreatePersonaResponse(BaseModel):
    """Response from create persona."""

    success: bool
    personaId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreatePersonaResponse,
    dependencies=[
        audit_activity(
            "persona.created", "{{ actor.name }} created persona '{{ persona.name }}'"
        )
    ],
)
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

            # Create persona with departments in single SQL (DHH style)
            sql_query = load_sql("sql/v3/personas/create_persona_complete.sql")
            sql_params = (
                request.name,
                description,
                request.active,
                request.color,
                request.icon,
                instructions,
                dept_ids,  # Always pass array (empty array if no departments)
                request.profileId,
                example_ids,  # Always pass array (empty array if no examples)
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to create persona")

            persona_id = result["persona_id"]
            actor_name = result["actor_name"]  # From SQL query

            # Set audit context with data from SQL query
            audit_set(
                http_request,
                actor={"name": actor_name, "id": request.profileId},
                persona={"name": request.name, "id": persona_id},
            )

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

"""Persona create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (CreatePersonaApiRequest, CreatePersonaApiResponse,
                           CreatePersonaSqlParams, CreatePersonaSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/personas/create_persona_complete.sql"


router = APIRouter()


@router.post(
    "/create",
    response_model=CreatePersonaApiResponse,
    dependencies=[
        audit_activity(
            "persona.created", "{{ actor.name }} created persona '{{ persona.name }}'"
        )
    ],
)
async def create_persona(
    request: CreatePersonaApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreatePersonaApiResponse:
    """Create a new persona."""
    tags = ["personas"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
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

            # Convert API request to SQL params (add profile_id from header)
            params = CreatePersonaSqlParams(
                name=request.name,
                description=description,
                active=request.active,
                color=request.color,
                icon=request.icon,
                instructions=instructions,
                department_ids=dept_ids,
                profile_id=profile_id,
                example_ids=example_ids,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                CreatePersonaSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.persona_id:
                raise ValueError("Failed to create persona")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    persona={"name": request.name, "id": str(result.persona_id)},
                )

        # Convert SQL result to API response
        api_response = CreatePersonaApiResponse.model_validate({
            "success": True,
            "personaId": str(result.persona_id),
            "message": f"Persona '{request.name}' created successfully",
        })

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
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

"""Persona delete endpoint - v3 API following DHH principles."""

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
class DeletePersonaRequest(BaseModel):
    """Request to delete persona."""

    personaId: str
    # profileId removed - comes from X-Profile-Id header


class DeletePersonaResponse(BaseModel):
    """Response from delete persona."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeletePersonaResponse,
    dependencies=[
        audit_activity(
            "persona.deleted", "{{ actor.name }} deleted persona '{{ persona.name }}'"
        )
    ],
)
async def delete_persona(
    request: DeletePersonaRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaResponse:
    """Delete a persona."""
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
            # Delete persona with usage check and name fetch (single query)
            sql_query = load_sql("app/sql/v3/personas/delete_persona_complete.sql")
            sql_params = (request.personaId, profile_id)
            result = await conn.fetchrow(sql_query, request.personaId, profile_id)

            if not result:
                raise ValueError("Failed to check persona usage")

            usage_count = result.get("usage_count", 0)
            if usage_count > 0:
                raise ValueError("Cannot delete persona that is in use by scenarios")

            if not result.get("deleted"):
                raise ValueError(f"Persona not found: {request.personaId}")

            persona_name = result.get("name", "Unknown")
            actor_name = result.get("actor_name")  # From SQL query

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    persona={"name": persona_name, "id": request.personaId},
                )

        result_data = DeletePersonaResponse(
            success=True,
            message=f"Persona '{persona_name}' deleted successfully",
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
            operation="delete_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

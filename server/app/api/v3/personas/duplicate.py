"""Persona duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicatePersonaRequest(BaseModel):
    """Request to duplicate persona."""

    personaId: str
    # profileId removed - comes from X-Profile-Id header


class DuplicatePersonaResponse(BaseModel):
    """Response from duplicate persona."""

    success: bool
    personaId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicatePersonaResponse,
    dependencies=[
        audit_activity(
            "persona.duplicated",
            "{{ actor.name }} duplicated persona '{{ persona.name }}'",
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Duplicate persona (fetch and duplicate in single query)
            sql_query = load_sql("sql/v3/personas/duplicate_persona_complete_v2.sql")
            sql_params = (request.personaId, profile_id)
            result = await conn.fetchrow(sql_query, request.personaId, profile_id)

            if not result or not result.get("new_persona_id"):
                raise ValueError(f"Persona not found: {request.personaId}")

            persona_id = result["new_persona_id"]
            original_name = result.get("original_name", "Unknown")
            actor_name = result.get("actor_name")  # From SQL query

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    persona={"name": original_name, "id": request.personaId},
                )

            result_data = DuplicatePersonaResponse(
                success=True,
                personaId=persona_id,
                message=f"Persona '{original_name}' duplicated successfully",
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
            operation="duplicate_persona",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

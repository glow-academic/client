"""Field update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class UpdateFieldRequest(BaseModel):
    """Request to update field."""

    fieldId: str
    name: str
    description: str
    active: bool = True
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    conditional_parameter_ids: list[str] | None = (
        None  # Parameters to show when this field is selected
    )
    # profileId removed - comes from X-Profile-Id header


class UpdateFieldResponse(BaseModel):
    """Response from update field."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateFieldResponse,
    dependencies=[
        audit_activity(
            "field.updated", "{{ actor.name }} updated field '{{ field.name }}'"
        )
    ],
)
async def update_field(
    request: UpdateFieldRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateFieldResponse:
    """Update an existing field."""
    tags = ["fields"]

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
            # Check if field exists
            check_sql = "SELECT name FROM fields WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.fieldId)

            if not existing:
                raise ValueError(f"Field not found: {request.fieldId}")

            sql_query = load_sql("sql/v3/fields/update_field_complete.sql")
            sql_params = (
                request.fieldId,
                request.name,
                request.description,
                request.active,
                request.department_ids,
                request.conditional_parameter_ids,
                profile_id,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            # Set audit context with data from SQL query
            if result:
                actor_name = result.get("actor_name")
                if actor_name:
                    audit_set(
                        http_request,
                        actor={"name": actor_name, "id": profile_id},
                        field={"name": request.name, "id": request.fieldId},
                    )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UpdateFieldResponse(
            success=True,
            message=f"Field '{request.name}' updated successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

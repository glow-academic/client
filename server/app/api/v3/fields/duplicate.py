"""Field duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class DuplicateFieldRequest(BaseModel):
    """Request to duplicate field."""

    fieldId: str
    # profileId removed - comes from X-Profile-Id header


class DuplicateFieldResponse(BaseModel):
    """Response from duplicate field."""

    success: bool
    fieldId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateFieldResponse,
    dependencies=[
        audit_activity(
            "field.duplicated",
            "{{ actor.name }} duplicated field '{{ field.name }}'",
        )
    ],
)
async def duplicate_field(
    request: DuplicateFieldRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateFieldResponse:
    """Duplicate a field with all parameter and department associations."""
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
            sql_query = load_sql("sql/v3/fields/duplicate_field_complete.sql")
            sql_params = (request.fieldId, profile_id)
            new_field = await conn.fetchrow(sql_query, request.fieldId, profile_id)

            if not new_field:
                raise ValueError(f"Field not found: {request.fieldId}")

            new_field_id = new_field["field_id"]
            actor_name = new_field.get("actor_name")
            field_name = new_field.get("field_name")

            # Set audit context with data from SQL query
            if actor_name and field_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    field={"name": field_name, "id": new_field_id},
                )

            # Get original field name for message
            original_field = await conn.fetchrow(
                "SELECT name FROM fields WHERE id = $1", request.fieldId
            )

            result_data = DuplicateFieldResponse(
                success=True,
                fieldId=new_field_id,
                message=f"Field '{original_field['name']}' duplicated successfully",
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
            operation="duplicate_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

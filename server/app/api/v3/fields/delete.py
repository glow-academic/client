"""Field delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


class DeleteFieldRequest(BaseModel):
    """Request to delete field."""

    fieldId: str
    # profileId removed - comes from X-Profile-Id header


class DeleteFieldResponse(BaseModel):
    """Response from delete field."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteFieldResponse,
    dependencies=[
        audit_activity(
            "field.deleted", "{{ actor.name }} deleted field '{{ field.name }}'"
        )
    ],
)
async def delete_field(
    request: DeleteFieldRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteFieldResponse:
    """Delete a field."""
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
            sql_query = load_sql("app/sql/v3/fields/delete_field_complete.sql")
            sql_params = (request.fieldId, profile_id)
            result = await conn.fetchrow(sql_query, request.fieldId, profile_id)

            if not result:
                raise ValueError(f"Field not found: {request.fieldId}")

            field_name = result.get("name")
            actor_name = result.get("actor_name")
            if not field_name:
                raise ValueError(f"Field not found: {request.fieldId}")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    field={"name": field_name, "id": request.fieldId},
                )

            result_data = DeleteFieldResponse(
                success=True,
                message=f"Field '{field_name}' deleted successfully",
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
            operation="delete_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

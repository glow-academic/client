"""Field create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


class CreateFieldRequest(BaseModel):
    """Request to create field."""

    name: str
    description: str
    active: bool = True
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    conditional_parameter_ids: list[str] | None = (
        None  # Parameters to show when this field is selected
    )
    # profileId removed - comes from X-Profile-Id header


class CreateFieldResponse(BaseModel):
    """Response from create field."""

    success: bool
    fieldId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateFieldResponse,
    dependencies=[
        audit_activity(
            "field.created", "{{ actor.name }} created field '{{ field.name }}'"
        )
    ],
)
async def create_field(
    request: CreateFieldRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateFieldResponse:
    """Create a new field with parameter and department associations."""
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
            sql_query = load_sql("app/sql/v3/fields/create_field_complete.sql")
            sql_params = (
                request.name,
                request.description,
                request.active,
                request.department_ids,
                request.conditional_parameter_ids,
                profile_id,
            )
            field_result = await conn.fetchrow(sql_query, *sql_params)

            if not field_result:
                raise ValueError("Failed to create field")

            field_id = field_result["field_id"]
            actor_name = field_result.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    field={"name": request.name, "id": field_id},
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateFieldResponse(
            success=True,
            fieldId=field_id,
            message=f"Field '{request.name}' created successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

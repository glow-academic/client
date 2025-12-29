"""Staff bulk create endpoint - bulk create staff members."""

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    BulkCreateStaffApiRequest,
    BulkCreateStaffApiResponse,
    BulkCreateStaffSqlParams,
    BulkCreateStaffSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/staff/bulk_create_staff_complete.sql"

router = APIRouter()


@router.post(
    "/create",
    response_model=BulkCreateStaffApiResponse,
    dependencies=[
        audit_activity(
            "staff.created", "{{ actor.name }} created {{ count }} staff member(s)"
        )
    ],
)
async def bulk_create_staff(
    request: BulkCreateStaffApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkCreateStaffApiResponse:
    """Bulk create profiles."""
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

        # Validate profiles
        for i, p in enumerate(request.profiles):
            if not p.first_name:
                raise HTTPException(
                    status_code=400,
                    detail=f"Profile {i + 1} must have a first name",
                )
            if not p.last_name:
                raise HTTPException(
                    status_code=400,
                    detail=f"Profile {i + 1} must have a last name",
                )
            if not p.emails or len(p.emails) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Profile {p.first_name} {p.last_name} must have at least one email",
                )
            primary_index = (
                p.primary_email_index if p.primary_email_index is not None else 0
            )
            if primary_index < 0 or primary_index >= len(p.emails):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid primary_email_index for {p.first_name} {p.last_name}",
                )

        # Convert API request to SQL params (add profile_id from header)
        # Use double-star pattern - SQL function handles the composite type array
        params = BulkCreateStaffSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute query with typed helper - automatically detects and calls function if present
            result = cast(
                BulkCreateStaffSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise HTTPException(status_code=500, detail="Failed to create profiles")

            # Check if any emails already exist
            existing_emails = result.existing_emails or []
            if existing_emails:
                raise HTTPException(
                    status_code=400,
                    detail=f"Emails already exist: {', '.join(existing_emails)}",
                )

            # Get created profile IDs
            created_ids = result.profile_ids or []
            if not created_ids:
                raise HTTPException(status_code=500, detail="Failed to create profiles")

        # Return auto-generated response type
        api_response = BulkCreateStaffApiResponse.model_validate(result.model_dump())

        # Set audit context
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                count=len(created_ids),
            )

        # Invalidate cache after mutation
        tags = ["staff", "profile"]  # Staff operations also affect profile cache
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="bulk_create_staff",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

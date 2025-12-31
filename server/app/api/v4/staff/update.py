"""Staff bulk update endpoint - bulk update staff members."""

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    BulkUpdateStaffApiRequest,
    BulkUpdateStaffApiResponse,
    BulkUpdateStaffSqlParams,
    BulkUpdateStaffSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/staff/bulk_update_staff_complete.sql"

router = APIRouter()


@router.post(
    "/update",
    response_model=BulkUpdateStaffApiResponse,
    dependencies=[
        audit_activity(
            "staff.updated", "{{ actor.name }} updated {{ count }} staff member(s)"
        )
    ],
)
async def bulk_update_staff(
    request: BulkUpdateStaffApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkUpdateStaffApiResponse:
    """Bulk update profiles."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get current user's profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Handle requests_per_day: auto-generated type expects int | None
        # Frontend might send "__keep__" string, but we'll handle that in frontend
        # For now, SQL handles None as unlimited via COALESCE

        # Convert API request to SQL params (add profile_id from header)
        # Use double-star pattern - SQL handles defaults via COALESCE
        params = BulkUpdateStaffSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute query with typed helper - automatically detects and calls function if present
            result = cast(
                BulkUpdateStaffSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise HTTPException(status_code=500, detail="Failed to update profiles")

            updated_count = result.updated_count or 0

            # Check if all profiles were updated (validation might have filtered some out)
            if updated_count < len(request.profile_ids):
                raise HTTPException(
                    status_code=403,
                    detail=f"Only {updated_count} of {len(request.profile_ids)} profiles were updated. Some profiles failed validation (role assignment, default profile editing, etc.).",
                )

        # Return auto-generated response type
        result_data = BulkUpdateStaffApiResponse(
            updated_count=updated_count,
            actor_name=result.actor_name,
        )

        # Set audit context
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                count=len(request.profile_ids),
            )

        # Invalidate cache after mutation
        tags = ["staff", "profile"]  # Staff operations also affect profile cache
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="bulk_update_staff",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

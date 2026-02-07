"""Staff bulk delete endpoint - bulk delete staff members."""

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    BulkDeleteStaffApiRequest,
    BulkDeleteStaffApiResponse,
    BulkDeleteStaffSqlParams,
    BulkDeleteStaffSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/staff/bulk_delete_staff_complete.sql"

router = APIRouter()


@router.post(
    "/delete",
    response_model=BulkDeleteStaffApiResponse,
    dependencies=[
        audit_activity(
            "staff.deleted", "{{ actor.name }} deleted {{ count }} staff member(s)"
        )
    ],
)
async def delete_staff(
    request: BulkDeleteStaffApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteStaffApiResponse:
    """Bulk delete profiles."""
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

        # Convert API request to SQL params (add profile_id from header)
        # Use double-star pattern
        params = BulkDeleteStaffSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            BulkDeleteStaffSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to delete profiles")

        deleted_count = result.deleted_count or 0

        if deleted_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No profiles could be deleted",
            )

        # Return auto-generated response type
        result_data = BulkDeleteStaffApiResponse(
            deleted_count=deleted_count,
            actor_name=result.actor_name,
        )

        # Set audit context
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                count=deleted_count,
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
            operation="delete_staff",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Staff bulk delete endpoint - bulk delete staff members."""

from typing import Annotated, Any

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql

router = APIRouter()


class BulkDeleteStaffRequest(BaseModel):
    """Request to bulk delete staff."""

    profileIds: list[str]


class BulkDeleteStaffResponse(BaseModel):
    """Response from bulk delete staff."""

    success: bool
    message: str


@router.post(
    "/delete",
    response_model=BulkDeleteStaffResponse,
    dependencies=[
        audit_activity(
            "staff.deleted", "{{ actor.name }} deleted {{ count }} staff member(s)"
        )
    ],
)
async def bulk_delete_staff(
    request: BulkDeleteStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteStaffResponse:
    """Bulk delete profiles."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Single consolidated query: checks defaults and deletes non-default profiles
        sql_query = load_sql("app/sql/v3/profile/staff/bulk_delete_profiles_complete.sql")
        sql_params = (request.profileIds,)

        result = await conn.fetchrow(sql_query, request.profileIds)

        if not result:
            raise HTTPException(status_code=500, detail="Failed to delete profiles")

        deleted_count = result.get("deleted_count", 0)

        if deleted_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No profiles could be deleted",
            )

        message = f"{deleted_count} staff members deleted successfully"

        result_data = BulkDeleteStaffResponse(success=True, message=message)

        # Fetch actor_name separately
        profile_id = http_request.state.profile_id
        actor_name_row = None
        if profile_id:
            actor_name_row = await conn.fetchrow(
                "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
                profile_id,
            )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
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
            operation="bulk_delete_staff",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

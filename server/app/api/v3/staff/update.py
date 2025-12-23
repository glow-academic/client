"""Staff bulk update endpoint - bulk update staff members."""

import uuid
from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql

router = APIRouter()


class BulkUpdateStaffRequest(BaseModel):
    """Request to bulk update staff."""

    profileIds: list[str]
    role: str | None = None
    requests_per_day: int | None | str = (
        None  # int for limit, None for unlimited, "__keep__" to not update
    )
    primary_department_id: str | None = None
    # currentProfileId removed - comes from X-Profile-Id header
    active: bool | None = None


class BulkUpdateStaffResponse(BaseModel):
    """Response from bulk update staff."""

    success: bool
    message: str


@router.post(
    "/update",
    response_model=BulkUpdateStaffResponse,
    dependencies=[
        audit_activity(
            "staff.updated", "{{ actor.name }} updated {{ count }} staff member(s)"
        )
    ],
)
async def bulk_update_staff(
    request: BulkUpdateStaffRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkUpdateStaffResponse:
    """Bulk update profiles."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get current user's profile_id from header (set by router-level dependency)
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert profile IDs to UUID array
        profile_uuids = [uuid.UUID(p) for p in request.profileIds]

        # Handle requests_per_day: "__keep__" means skip, None means unlimited (-1 in SQL), int means limit
        requests_per_day_value = None
        if (
            isinstance(request.requests_per_day, str)
            and request.requests_per_day == "__keep__"
        ):
            requests_per_day_value = None  # Skip update
        elif (
            isinstance(request.requests_per_day, str)
            and request.requests_per_day != "__keep__"
        ):
            try:
                requests_per_day_value = int(request.requests_per_day)
            except (ValueError, TypeError):
                requests_per_day_value = -1  # Invalid -> unlimited (NULL in DB)
        elif isinstance(request.requests_per_day, int):
            requests_per_day_value = request.requests_per_day
        elif request.requests_per_day is None:
            requests_per_day_value = -1  # None -> unlimited (NULL in DB)

        # Handle primary_department_id: convert to UUID if provided, None if not
        primary_department_uuid = None
        if request.primary_department_id:
            try:
                primary_department_uuid = uuid.UUID(request.primary_department_id)
            except (ValueError, TypeError):
                primary_department_uuid = None  # Invalid UUID -> skip update

        # Single consolidated query for validation + update
        sql_query = load_sql("app/sql/v3/profile/staff/bulk_update_profile_complete.sql")
        sql_params = (
            uuid.UUID(current_profile_id),
            profile_uuids,
            request.role,
            request.active,
            requests_per_day_value,
            primary_department_uuid,
        )

        async with transaction(conn):
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(status_code=500, detail="Failed to update profiles")

            updated_count = result["updated_count"]

            # Check if all profiles were updated (validation might have filtered some out)
            if updated_count < len(request.profileIds):
                raise HTTPException(
                    status_code=403,
                    detail=f"Only {updated_count} of {len(request.profileIds)} profiles were updated. Some profiles failed validation (role assignment, default profile editing, etc.).",
                )

        result_data = BulkUpdateStaffResponse(
            success=True,
            message=f"{len(request.profileIds)} staff members updated successfully",
        )

        # Fetch actor_name separately
        actor_name_row = await conn.fetchrow(
            "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
            current_profile_id,
        )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": current_profile_id},
                count=len(request.profileIds),
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

"""Staff bulk create or update endpoint - bulk create or update staff members."""

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
    UpsertStaffApiRequest,
    UpsertStaffApiResponse,
    UpsertStaffSqlParams,
    UpsertStaffSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/staff/upsert_staff_complete.sql"

router = APIRouter()


@router.post(
    "/upsert",
    response_model=UpsertStaffApiResponse,
    dependencies=[
        audit_activity(
            "staff.upserted",
            "{{ actor.name }} {{ action }} {{ count }} staff member(s)",
        )
    ],
)
async def bulk_create_or_update_staff(
    request: UpsertStaffApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpsertStaffApiResponse:
    """Bulk create or update staff members."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get current user's profile_id from header (set by router-level dependency)
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Validate all profiles before processing
        for i, profile_req in enumerate(request.profiles):
            if not profile_req.emails or len(profile_req.emails) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Profile {i + 1} must have at least one email",
                )
            primary_index = (
                profile_req.primary_email_index
                if profile_req.primary_email_index is not None
                else 0
            )
            if primary_index < 0 or primary_index >= len(profile_req.emails):
                raise HTTPException(
                    status_code=400,
                    detail=f"Profile {i + 1} has invalid primary_email_index",
                )

        # Convert API request to SQL params (add current_profile_id from header)
        # Use double-star pattern - SQL handles bulk operation
        # current_profile_id comes from header, will override if accidentally in request
        params = UpsertStaffSqlParams(
            **request.model_dump(),
            current_profile_id=uuid.UUID(current_profile_id),
        )
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute query with typed helper - SQL handles bulk upsert
            result = cast(
                UpsertStaffSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.profile_ids:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to create or update staff profiles",
                )

        # Convert SQL result to API response
        api_response = UpsertStaffApiResponse.model_validate(result.model_dump())

        # Set audit context
        if result.actor_name:
            action = "upserted"
            if (
                result.created_count
                and result.created_count > 0
                and result.updated_count == 0
            ):
                action = "created"
            elif (
                result.updated_count
                and result.updated_count > 0
                and result.created_count == 0
            ):
                action = "updated"
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": current_profile_id},
                action=action,
                count=len(result.profile_ids) if result.profile_ids else 0,
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
            operation="bulk_create_or_update_staff",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

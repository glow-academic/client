"""Profile update endpoint - update profile fields."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    UpdateProfileApiRequest,
    UpdateProfileApiResponse,
    UpdateProfileSqlParams,
    UpdateProfileSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/profile/update_profile_complete.sql"

router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateProfileApiResponse,
    dependencies=[
        audit_activity(
            "profile.updated", "{{ actor.name }} updated profile '{{ profile.name }}'"
        )
    ],
)
async def update_profile(
    request: UpdateProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateProfileApiResponse:
    """Update profile fields - supports both simple auth updates and comprehensive staff updates."""
    tags = ["profile"]  # From router tags

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

        # Validate emails array if provided
        if request.emails is not None and len(request.emails) == 0:
            raise HTTPException(
                status_code=400, detail="At least one email is required"
            )

        # Determine primary email index (default to 0)
        primary_index = (
            request.primary_email_index
            if request.primary_email_index is not None
            else 0
        )
        if request.emails and (
            primary_index < 0 or primary_index >= len(request.emails)
        ):
            raise HTTPException(status_code=400, detail="Invalid primary_email_index")

        # Convert API request to SQL params using double star pattern
        # SQL function expects: target_profile_id (UUID - the profile to update), profile_id (UUID - actor from header), and other fields
        # Note: target_profile_id should be in API request type (the profile being updated)
        request_dict = request.model_dump(exclude={"profile_id"}, exclude_none=False)
        # Get target_profile_id from request body (required for update)
        target_profile_id = request_dict.get("target_profile_id")
        if not target_profile_id:
            raise HTTPException(
                status_code=400,
                detail="target_profile_id is required in request body",
            )

        # Use double star pattern - SQL handles None-to-empty conversions via COALESCE in params CTE
        params = UpdateProfileSqlParams(
            **request_dict,
            target_profile_id=target_profile_id,
            profile_id=profile_id,
            primary_email_index=primary_index if request.emails else None,
        )
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute SQL with typed helper
            result = cast(
                UpdateProfileSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            # Check if profile exists
            if not result.profile_exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile not found: {target_profile_id}",
                )

            if not result.profile_id:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile not found: {target_profile_id}",
                )

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    profile={"name": result.name, "id": str(result.profile_id)},
                )

        # Convert SQL result to API response
        response_data = UpdateProfileApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

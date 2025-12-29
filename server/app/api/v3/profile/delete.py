"""Profile delete endpoint - delete a profile."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DeleteProfileApiRequest,
    DeleteProfileApiResponse,
    DeleteProfileSqlParams,
    DeleteProfileSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/profile/delete_profile_complete.sql"

router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteProfileApiResponse,
    dependencies=[
        audit_activity(
            "profile.deleted", "{{ actor.name }} deleted profile '{{ profile.name }}'"
        )
    ],
)
async def delete_profile(
    request: DeleteProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteProfileApiResponse:
    """Delete a profile."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params using double star pattern (add current_profile_id from header)
        # Exclude current_profile_id from request if present (it comes from header, not request body)
        request_dict = request.model_dump(
            exclude={"current_profile_id"}, exclude_none=False
        )
        params = DeleteProfileSqlParams(
            **request_dict, current_profile_id=current_profile_id
        )
        sql_params = params.to_tuple()

        result = cast(
            DeleteProfileSqlRow,
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
                detail=f"Profile not found: {request.target_profile_id}",
            )

        # Verify deletion occurred
        if not result.deleted:
            raise HTTPException(status_code=500, detail="Failed to delete profile")

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": current_profile_id},
                profile={"name": result.name, "id": str(result.profile_id)},
            )

        # Convert SQL result to API response
        response_data = DeleteProfileApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        tags = ["profile"]  # Profile operations
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

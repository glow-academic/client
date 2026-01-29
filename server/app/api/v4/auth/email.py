"""Profile by email endpoint - get profile by email."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetProfileByEmailApiRequest,
    GetProfileByEmailApiResponse,
    GetProfileByEmailSqlParams,
    GetProfileByEmailSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/profile/get_profile_by_email_complete.sql"

router = APIRouter()


@router.post(
    "/email",
    response_model=GetProfileByEmailApiResponse,
    dependencies=[
        audit_activity("profile.email", "{{ actor.name }} viewed profile by email")
    ],
)
async def get_profile_by_email(
    request: GetProfileByEmailApiRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileByEmailApiResponse:
    """Get profile by email (for auth operations)."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        # Note: profile_id is optional - only used for audit logging
        profile_id = getattr(http_request.state, "profile_id", None)

        # Convert API request to SQL params using double star pattern
        # Note: profile_id is passed to SQL function for actor_name computation (optional)
        params = GetProfileByEmailSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetProfileByEmailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Note: actor_name is now computed in SQL and returned in result - no inline SQL needed
        # Set audit context using actor_name from SQL result
        if result.actor_name and profile_id:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response
        return GetProfileByEmailApiResponse.model_validate(result.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_by_email",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

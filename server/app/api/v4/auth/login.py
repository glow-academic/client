"""Auth login endpoint - returns list of active provider options and departments."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity
from app.main import get_db
from app.sql.types import (GetLoginDataApiRequest, GetLoginDataApiResponse,
                           GetLoginDataSqlParams, GetLoginDataSqlRow)
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, Request

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/auth/get_login_data_complete.sql"


router = APIRouter()


@router.post(
    "/login",
    response_model=GetLoginDataApiResponse,
    dependencies=[audit_activity("auth.login", "User accessed login page")],
)
async def get_login_providers(
    request: GetLoginDataApiRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetLoginDataApiResponse:
    """Get list of active auth provider options and departments for login page."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Read department-id cookie for provider filtering (like profile/context endpoint)
        department_id_cookie = http_request.cookies.get("department-id")

        # Use department_id from request body if provided, otherwise use cookie as fallback
        # Convert cookie string to UUID if present
        department_id: UUID | None = None
        if request.department_id:
            department_id = request.department_id
        elif department_id_cookie:
            try:
                department_id = UUID(department_id_cookie)
            except ValueError:
                # Invalid UUID in cookie, ignore it
                department_id = None

        # Convert API request to SQL params with cookie fallback
        # Note: SQL function expects uuid | NULL
        params = GetLoginDataSqlParams(department_id=department_id)
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetLoginDataSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Convert SQL result to API response (all fields come from SQL)
        api_response = GetLoginDataApiResponse.model_validate(result.model_dump())

        return api_response
    except Exception:
        # Return empty response if error occurs
        return GetLoginDataApiResponse(
            providers=[],
            departments=[],
            guest_login_enabled=True,
            default_department_id=None,
            realm_name="master",
            organization_id=None,
        )

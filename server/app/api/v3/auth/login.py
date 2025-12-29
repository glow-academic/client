"""Auth login endpoint - returns list of active provider options and departments."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity
from app.main import get_db
from app.sql.types import (
    GetLoginDataApiRequest,
    GetLoginDataApiResponse,
    GetLoginDataSqlParams,
    GetLoginDataSqlRow,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/auth/get_login_data_complete.sql"


router = APIRouter()


@router.post(
    "/login",
    response_model=GetLoginDataApiResponse,
    dependencies=[audit_activity("auth.login", "User accessed login page")],
)
async def get_login_providers(
    request: GetLoginDataApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetLoginDataApiResponse:
    """Get list of active auth provider options and departments for login page."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert API request to SQL params
        # Note: request.department_id is optional UUID, SQL function expects uuid | NULL
        params = GetLoginDataSqlParams(**request.model_dump())
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

        # Convert SQL result to API response (all fields including show_default_account come from SQL)
        api_response = GetLoginDataApiResponse.model_validate(result.model_dump())

        return api_response
    except Exception:
        # Return empty response if error occurs
        return GetLoginDataApiResponse(
            providers=[],
            departments=[],
            guest_login_enabled=True,
            show_default_account=False,
            default_department_id=None,
            realm_name="master",
        )

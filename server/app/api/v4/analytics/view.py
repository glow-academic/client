"""Analytics view creation v4 API endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreateAnalyticsViewFunctionApiRequest,
    CreateAnalyticsViewFunctionApiResponse,
    CreateAnalyticsViewFunctionSqlParams,
    CreateAnalyticsViewFunctionSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/analytics/create_analytics_view_function_complete.sql"

router = APIRouter()


@router.post(
    "/view",
    response_model=CreateAnalyticsViewFunctionApiResponse,
    dependencies=[
        audit_activity(
            "analytics.view.created", "{{ actor.name }} created analytics view"
        )
    ],
)
async def create_analytics_view(
    request: CreateAnalyticsViewFunctionApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAnalyticsViewFunctionApiResponse:
    """Create or recreate the analytics materialized view with all indexes."""
    tags = ["analytics"]  # From router tags

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

        # Execute the view creation SQL (DDL operations) first
        # Note: DDL operations cannot be in functions, so this is handled separately
        view_creation_sql = load_sql(
            "app/sql/v4/analytics/create_analytics_view_complete.sql"
        )
        await conn.execute(view_creation_sql)

        # Now call the function to get actor_name and response
        # Use double star pattern for parameter construction
        import uuid

        params = CreateAnalyticsViewFunctionSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            CreateAnalyticsViewFunctionSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Build response - SQL function returns structured data
        api_response = CreateAnalyticsViewFunctionApiResponse.model_validate(
            result.model_dump()
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_analytics_view",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Analytics refresh v4 API endpoint - handles both view creation and refresh."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (RefreshAnalyticsApiRequest,
                           RefreshAnalyticsApiResponse,
                           RefreshAnalyticsSqlParams, RefreshAnalyticsSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed, load_sql

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/analytics/refresh_analytics_complete.sql"
VIEW_CREATION_SQL_PATH = "app/sql/v4/analytics/create_analytics_view_complete.sql"

router = APIRouter()


@router.post(
    "/refresh",
    response_model=RefreshAnalyticsApiResponse,
    dependencies=[
        audit_activity("analytics.refreshed", "{{ actor.name }} refreshed analytics")
    ],
)
async def refresh_analytics(
    request: RefreshAnalyticsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshAnalyticsApiResponse:
    """Refresh the analytics materialized view. Creates view if it doesn't exist."""
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

        # Check if analytics view exists, create if not
        view_exists = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM pg_matviews 
                WHERE schemaname = 'public' 
                AND matviewname = 'analytics'
            )
            """
        )

        if not view_exists:
            # Execute the view creation SQL (DDL operations)
            # Note: DDL operations cannot be in functions, so this is handled separately
            view_creation_sql = load_sql(VIEW_CREATION_SQL_PATH)
            await conn.execute(view_creation_sql)

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern for parameter construction
        import uuid

        params = RefreshAnalyticsSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            RefreshAnalyticsSqlRow,
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
        api_response = RefreshAnalyticsApiResponse.model_validate(result.model_dump())

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
            operation="refresh_analytics",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

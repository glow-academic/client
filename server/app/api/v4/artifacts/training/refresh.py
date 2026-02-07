"""Training refresh endpoint - POST /training/refresh.

Uses api_refresh_home_mvs_new_v4 SQL function to refresh all home MVs in dependency order.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    RefreshHomeMvsNewApiRequest,
    RefreshHomeMvsNewApiResponse,
    RefreshHomeMvsNewSqlParams,
    RefreshHomeMvsNewSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/refresh_home_mvs_new_complete.sql"

router = APIRouter()


@router.post(
    "/refresh",
    response_model=RefreshHomeMvsNewApiResponse,
    dependencies=[
        audit_activity("training.refresh", "{{ actor.name }} refreshed training MVs")
    ],
)
async def training_refresh(
    request: RefreshHomeMvsNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshHomeMvsNewApiResponse:
    """Refresh all training section materialized views.

    Uses SQL function that refreshes MVs in dependency order:
    1. mv_home_chat_facts (base fact table)
    2. mv_home_simulation_status (depends on chat_facts)
    3. mv_home_attempt_history (depends on chat_facts)
    4. mv_home_certificate_status (depends on chat_facts)
    """
    tags = ["training", "home"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params
        request_dict = request.model_dump(mode="json")
        params = RefreshHomeMvsNewSqlParams(**request_dict, profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        # Execute SQL function
        result = cast(
            RefreshHomeMvsNewSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert to API response
        api_response = RefreshHomeMvsNewApiResponse.model_validate(result.model_dump())

        # Invalidate cache after refresh
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="training_refresh",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

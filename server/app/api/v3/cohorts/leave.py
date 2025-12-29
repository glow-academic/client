"""Cohort leave endpoint - v3 API."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    LeaveCohortApiRequest,
    LeaveCohortApiResponse,
    LeaveCohortSqlParams,
    LeaveCohortSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/cohorts/leave_cohort_complete.sql"


router = APIRouter()


@router.post(
    "/leave",
    response_model=LeaveCohortApiResponse,
    dependencies=[
        audit_activity(
            "cohort.left", "{{ actor.name }} left cohort '{{ cohort.name }}'"
        )
    ],
)
async def leave_cohort(
    request: LeaveCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaveCohortApiResponse:
    """Remove profile from cohort (leave cohort)."""
    tags = ["cohorts"]  # From router tags

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

        # Convert API request to SQL params (add profile_id from header)
        params = LeaveCohortSqlParams(
            cohort_id=request.cohort_id,
            profile_id=uuid.UUID(profile_id),
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            LeaveCohortSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result:
            raise HTTPException(
                status_code=404, detail="Cohort not found or you are not a member"
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                cohort={
                    "name": result.cohort_title or "Unknown",
                    "id": str(request.cohort_id),
                },
            )

        # Convert SQL result to API response (no manual conversion needed)
        api_response = LeaveCohortApiResponse.model_validate(result.model_dump())

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
            operation="leave_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

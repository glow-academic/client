"""Cohort duplicate endpoint - v4 API."""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DuplicateCohortApiRequest,
    DuplicateCohortApiResponse,
    DuplicateCohortSqlParams,
    DuplicateCohortSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/cohorts/duplicate_cohort_complete.sql"


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateCohortApiResponse,
    dependencies=[
        audit_activity(
            "cohort.duplicated",
            "{{ actor.name }} duplicated cohort '{{ cohort.name }}'",
        )
    ],
)
async def duplicate_cohort(
    request: DuplicateCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateCohortApiResponse:
    """Duplicate a cohort with relationships."""
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

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DuplicateCohortSqlParams(
                cohort_id=request.cohort_id,
                profile_id=uuid.UUID(profile_id),
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DuplicateCohortSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.id:
                raise HTTPException(status_code=404, detail="Cohort not found")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    cohort={"name": result.title or "Unknown", "id": str(result.id)},
                )

        # Convert SQL result to API response (no manual conversion needed)
        api_response = DuplicateCohortApiResponse.model_validate(result.model_dump())

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
            operation="duplicate_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

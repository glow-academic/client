"""Cohort save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (cohort_id = NULL) and update (cohort_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SaveCohortApiRequest,
    SaveCohortApiResponse,
    SaveCohortSqlParams,
    SaveCohortSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/cohorts/save_cohort_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveCohortApiResponse,
    dependencies=[
        audit_activity(
            "cohort.saved",
            "{{ actor.name }} {% if cohort %}updated{% else %}created{% endif %} cohort{% if cohort %} '{{ cohort.name }}'{% endif %}",
        )
    ],
)
async def save_cohort(
    request: SaveCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveCohortApiResponse:
    """Save cohort - handles both create (cohort_id = NULL) and update (cohort_id provided)."""
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
            # Map input_cohort_id from API request (already correct field name)
            params = SaveCohortSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveCohortSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.cohort_id:
                if request.input_cohort_id:
                    raise ValueError(f"Cohort not found: {request.input_cohort_id}")
                else:
                    raise ValueError("Failed to create cohort")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add cohort to audit context if input_cohort_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use the request name if available
                if request.input_cohort_id:
                    # Update mode: use request name (from request body)
                    # Note: In update mode, request should have name field
                    audit_ctx["cohort"] = {
                        "name": getattr(request, "name", "Cohort"),
                        "id": str(result.cohort_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveCohortApiResponse.model_validate(
            {
                "cohort_id": str(result.cohort_id),
                "actor_name": result.actor_name,
            }
        )

        # Invalidate cache after mutation
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
            operation="save_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

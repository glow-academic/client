"""Rubric update endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    UpdateRubricApiRequest,
    UpdateRubricApiResponse,
    UpdateRubricSqlParams,
    UpdateRubricSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/rubrics/update_rubric_complete.sql"


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateRubricApiResponse,
    dependencies=[
        audit_activity(
            "rubric.updated", "{{ actor.name }} updated rubric '{{ rubric.name }}'"
        )
    ],
)
async def update_rubric(
    request: UpdateRubricApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateRubricApiResponse:
    """Update an existing rubric (replaces entire hierarchy)."""
    tags = ["rubrics"]  # From router tags

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
        # Use double star pattern: **request.model_dump()
        params = UpdateRubricSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            UpdateRubricSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.rubric_id:
            raise HTTPException(status_code=404, detail="Rubric not found")

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                rubric={"name": result.rubric_name, "id": str(request.rubric_id)},
            )

        # Convert SQL result to API response
        api_response = UpdateRubricApiResponse.model_validate(
            {
                "success": True,
                "message": "Rubric updated successfully",
            }
        )

        # Invalidate cache after mutation (both list and individual rubric)
        all_tags = tags + [f"rubric:{request.rubric_id}"]
        await invalidate_tags(all_tags)
        response.headers["X-Invalidate-Tags"] = ",".join(all_tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

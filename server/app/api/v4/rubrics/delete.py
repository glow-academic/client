"""Rubric delete endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DeleteRubricApiRequest,
    DeleteRubricApiResponse,
    DeleteRubricSqlParams,
    DeleteRubricSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/rubrics/delete_rubric_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteRubricApiResponse,
    dependencies=[
        audit_activity(
            "rubric.deleted", "{{ actor.name }} deleted rubric '{{ rubric.name }}'"
        )
    ],
)
async def delete_rubric(
    request: DeleteRubricApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteRubricApiResponse:
    """Delete a rubric."""
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
        params = DeleteRubricSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            DeleteRubricSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.rubric_id:
            # Rubric doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Rubric {request.rubric_id} not found"
            )

        # Check if rubric was deleted or is in use
        if not result.deleted:
            # Rubric exists but is in use
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete rubric: in use by {result.usage_count} simulation(s)",
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                rubric={"name": result.name, "id": str(request.rubric_id)},
            )

        # Convert SQL result to API response
        api_response = DeleteRubricApiResponse.model_validate(
            {
                "success": True,
                "message": "Rubric deleted successfully",
            }
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
            operation="delete_rubric",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

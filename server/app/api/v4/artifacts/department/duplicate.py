"""Department duplicate endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    DuplicateDepartmentApiRequest,
    DuplicateDepartmentApiResponse,
    DuplicateDepartmentSqlParams,
    DuplicateDepartmentSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/departments/duplicate_department_complete.sql"

router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateDepartmentApiResponse,
    dependencies=[
        audit_activity(
            "department.duplicated",
            "{{ actor.name }} duplicated department '{{ department.title }}'",
        )
    ],
)
async def duplicate_department(
    request: DuplicateDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateDepartmentApiResponse:
    """Duplicate a department."""
    tags = ["departments"]  # From router tags

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

        async with transaction(conn):
            # Convert API request to SQL params (add profile_id from header)
            params = DuplicateDepartmentSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                DuplicateDepartmentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result.new_department_id:
                raise HTTPException(
                    status_code=404,
                    detail=f"Department {request.department_id} not found",
                )

            new_department_id = result.new_department_id
            original_title = result.original_title or "Unknown"
            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    department={
                        "title": original_title,
                        "id": str(request.department_id),
                    },
                )

        result_response = DuplicateDepartmentApiResponse.model_validate(
            result.model_dump()
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

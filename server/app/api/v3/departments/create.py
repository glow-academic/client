"""Department create endpoint - v3 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, get_internal_sio, transaction
from app.sql.types import (
    CreateDepartmentApiRequest,
    CreateDepartmentApiResponse,
    CreateDepartmentSqlParams,
    CreateDepartmentSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/departments/create_department_complete.sql"

router = APIRouter()


@router.post(
    "/create",
    response_model=CreateDepartmentApiResponse,
    dependencies=[
        audit_activity(
            "department.created",
            "{{ actor.name }} created department '{{ department.title }}'",
        )
    ],
)
async def create_department(
    request: CreateDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateDepartmentApiResponse:
    """Create a new department."""
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
            params = CreateDepartmentSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                CreateDepartmentSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result.department_id:
                raise HTTPException(
                    status_code=500, detail="Failed to create department"
                )

            department_id = result.department_id
            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    department={"title": request.title, "id": str(department_id)},
                )

        result_response = CreateDepartmentApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Trigger Keycloak sync for the new department
        await internal_sio.emit("keycloak_sync", {"department_id": str(department_id)})

        return result_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

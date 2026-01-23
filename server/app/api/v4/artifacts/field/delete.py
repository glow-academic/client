"""Field delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    DeleteFieldApiRequest,
    DeleteFieldApiResponse,
    DeleteFieldSqlParams,
    DeleteFieldSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/fields/delete_field_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteFieldApiResponse,
    dependencies=[
        audit_activity(
            "field.deleted", "{{ actor.name }} deleted field '{{ field.name }}'"
        )
    ],
)
async def delete_field(
    request: DeleteFieldApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteFieldApiResponse:
    """Delete a field."""
    tags = ["fields"]

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
            params = DeleteFieldSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DeleteFieldSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise HTTPException(status_code=404, detail="Field not found")

            # Check if field exists using SQL result
            if not result.field_exists:
                raise HTTPException(
                    status_code=404, detail=f"Field not found: {request.field_id}"
                )

            if not result.name:
                raise HTTPException(
                    status_code=404, detail=f"Field not found: {request.field_id}"
                )

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_set(
                    http_request,
                    actor={"name": result.actor_name, "id": profile_id},
                    field={"name": result.name, "id": str(request.field_id)},
                )

        # Convert SQL result to API response (no manual conversion needed)
        api_response = DeleteFieldApiResponse.model_validate(result.model_dump())

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
            operation="delete_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

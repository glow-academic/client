"""Auth delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    DeleteAuthApiRequest,
    DeleteAuthApiResponse,
    DeleteAuthSqlParams,
    DeleteAuthSqlRow,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/auth/delete_auth_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteAuthApiResponse,
    dependencies=[
        audit_activity(
            "auth.deleted", "{{ actor.name }} deleted auth '{{ auth.name }}'"
        )
    ],
)
async def delete_auth(
    request: DeleteAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAuthApiResponse:
    """Delete an auth entry."""
    tags = ["auth"]

    sql_query: str | None = None
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
            params = DeleteAuthSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DeleteAuthSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            # Check if auth exists using SQL result
            if not result.auth_exists:
                raise HTTPException(
                    status_code=404, detail=f"Auth {request.auth_id} not found"
                )

            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    auth={"name": result.name, "id": str(request.auth_id)},
                )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            # Trigger Keycloak sync (fire-and-forget)
            from app.infra.v3.auth.keycloak_sync import perform_keycloak_sync

            await perform_keycloak_sync(department_id=None)

            # Convert SQL result to API response
            api_response = DeleteAuthApiResponse.model_validate(result.model_dump())
            return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

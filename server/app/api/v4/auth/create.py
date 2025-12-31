"""Auth create endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.auth.keycloak_sync import perform_keycloak_sync
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    CreateAuthApiRequest,
    CreateAuthApiResponse,
    CreateAuthSqlParams,
    CreateAuthSqlRow,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/auth/create_auth_complete.sql"


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateAuthApiResponse,
    dependencies=[
        audit_activity(
            "auth.created", "{{ actor.name }} created auth '{{ auth.name }}'"
        )
    ],
)
async def create_auth(
    request: CreateAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAuthApiResponse:
    """Create a new auth entry with nested items."""
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
            # Use double star pattern: **request.model_dump()
            params = CreateAuthSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                CreateAuthSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            auth_id = result.auth_id
            actor_name = result.actor_name

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    auth={"name": request.name, "id": auth_id},
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Trigger Keycloak sync (fire-and-forget)
        await perform_keycloak_sync(department_id=None)

        # Convert SQL result to API response
        api_response = CreateAuthApiResponse.model_validate(result.model_dump())
        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

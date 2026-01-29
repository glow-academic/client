"""Auth save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (auth_id = NULL) and update (auth_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.auth.keycloak_sync import perform_keycloak_sync
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SaveAuthApiRequest,
    SaveAuthApiResponse,
    SaveAuthSqlParams,
    SaveAuthSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/auth/save_auth_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveAuthApiResponse,
    dependencies=[
        audit_activity(
            "auth.saved",
            "{{ actor.name }} {% if auth %}updated{% else %}created{% endif %} auth{% if auth %} '{{ auth.name }}'{% endif %}",
        )
    ],
)
async def save_auth(
    request: SaveAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveAuthApiResponse:
    """Save auth - handles both create (auth_id = NULL) and update (auth_id provided)."""
    tags = ["auth"]  # From router tags

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
            # Map input_auth_id from API request (already correct field name)
            params = SaveAuthSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveAuthSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.auth_id:
                if request.input_auth_id:
                    raise ValueError(f"Auth not found: {request.input_auth_id}")
                else:
                    raise ValueError("Failed to create auth")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add auth to audit context if input_auth_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use the request name if available
                if request.input_auth_id:
                    # Update mode: use request name (from request body)
                    # Note: In update mode, request should have name_id field
                    # We'll need to fetch the name from the name_id
                    audit_ctx["auth"] = {
                        "name": "Auth",  # Will be updated with actual name if available
                        "id": str(result.auth_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveAuthApiResponse.model_validate(
            {
                "auth_id": str(result.auth_id),
                "actor_name": result.actor_name,
            }
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Trigger Keycloak sync (fire-and-forget)
        await perform_keycloak_sync(department_id=None)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

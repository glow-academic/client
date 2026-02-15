"""Auth save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (auth_id = NULL) and update (auth_id provided).
Uses access check SQL + Python permission logic before executing save.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.auth.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.api.v4.artifacts.auth.types import (
    SaveAuthApiRequest,
    SaveAuthApiResponse,
    SaveAuthSqlParams,
    SaveAuthSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.auth.keycloak_sync import perform_keycloak_sync
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckAuthSaveAccessSqlParams,
    CheckAuthSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/v4/queries/auth/check_auth_save_access_complete.sql"
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
    tags = ["auth"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for permissions and audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role using typed SQL
        access_params = CheckAuthSaveAccessSqlParams(
            profile_id=profile_id,
            auth_id=request.input_auth_id,
        )
        access_result = cast(
            CheckAuthSaveAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_CHECK_SQL_PATH,
                params=access_params,
            ),
        )

        if not access_result:
            raise HTTPException(
                status_code=401,
                detail="Unable to verify user permissions.",
            )

        # Permission logic: create vs update mode
        if not request.input_auth_id:
            can_save_result = compute_can_create(user_role=user_role)
        else:
            can_save_result = compute_can_edit(user_role=user_role)

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this auth entry.",
            )

        async with conn.transaction():
            params = SaveAuthSqlParams.from_request(request, profile_id)
            sql_params = params.to_tuple()

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

            # Set audit context
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                if request.input_auth_id:
                    audit_ctx["auth"] = {
                        "name": "Auth",
                        "id": str(result.auth_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Build response
        is_update = request.input_auth_id is not None
        api_response = SaveAuthApiResponse(
            success=True,
            auth_id=result.auth_id,
            message="Auth updated successfully"
            if is_update
            else "Auth created successfully",
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

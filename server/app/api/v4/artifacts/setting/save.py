"""Settings save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (setting_id = NULL) and update (setting_id provided).
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.setting.permissions import compute_can_edit
from app.api.v4.artifacts.setting.types import (
    SaveSettingApiRequest,
    SaveSettingApiResponse,
    SaveSettingSqlParams,
    SaveSettingSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckSettingSaveAccessSqlParams,
    CheckSettingSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/settings/check_setting_save_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/settings/save_setting_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveSettingApiResponse,
    dependencies=[
        audit_activity(
            "setting.saved",
            "{{ actor.name }} {% if setting %}updated{% else %}created{% endif %} setting{% if setting %} '{{ setting.name }}'{% endif %}",
        )
    ],
)
async def save_setting(
    request: SaveSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveSettingApiResponse:
    """Save setting - handles both create (setting_id = NULL) and update (setting_id provided)."""
    tags = ["settings"]  # From router tags

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
                user_department_ids: list[UUID] = [
                    d.department_id
                    for d in profile_ctx.departments
                    if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission check: get setting department_ids using typed SQL
        access_params = CheckSettingSaveAccessSqlParams(
            profile_id=profile_id,
            setting_id=request.input_setting_id,
        )
        access_result = cast(
            CheckSettingSaveAccessSqlRow,
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
        if request.input_setting_id:
            # Update mode: check department access
            can_save = compute_can_edit(
                user_role=user_role,
                user_department_ids=user_department_ids,
                setting_department_ids=access_result.setting_department_ids or [],
            )
        else:
            # Create mode: any authenticated user can create
            can_save = user_role is not None

        if not can_save:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this setting.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = SaveSettingSqlParams.from_request(request, profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveSettingSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.setting_id:
                if request.input_setting_id:
                    raise ValueError(f"Setting not found: {request.input_setting_id}")
                else:
                    raise ValueError("Failed to create setting")

            # Set audit context with data from SQL query
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                # Only add setting to audit context if input_setting_id was provided (update mode)
                # For create mode, we don't have the name yet, so we'll use the request name if available
                if request.input_setting_id:
                    # Update mode: use request name (from request body)
                    # Note: In update mode, request should have name field
                    audit_ctx["setting"] = {
                        "name": getattr(request, "name", "Setting"),
                        "id": str(result.setting_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveSettingApiResponse.model_validate(
            {
                "setting_id": str(result.setting_id),
                "actor_name": actor_name,
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
            operation="save_setting",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

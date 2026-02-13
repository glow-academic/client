"""Settings save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (setting_id = NULL) and update (setting_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.setting.types import (
    SaveSettingApiRequest,
    SaveSettingApiResponse,
    SaveSettingSqlParams,
    SaveSettingSqlRow,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
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

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
        else:
            actor_name = None

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = SaveSettingSqlParams(
                profile_id=profile_id,
                group_id=request.group_id,
                input_setting_id=request.input_setting_id,
                names=request.names,
                descriptions=request.descriptions,
                colors=request.colors,
                flags=request.flags,
                departments=request.departments,
                profiles=request.profiles,
                auths=request.auths,
                provider_keys=request.provider_keys,
                auth_item_keys=request.auth_item_keys,
                roles=request.roles,
                role_routes=request.role_routes,
            )
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

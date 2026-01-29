"""Settings save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (setting_id = NULL) and update (setting_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SaveSettingApiRequest,
    SaveSettingApiResponse,
    SaveSettingSqlParams,
    SaveSettingSqlRow,
    load_sql_query,
)
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

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            # Map input_setting_id from API request (already correct field name)
            params = SaveSettingSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
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
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
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
                "actor_name": result.actor_name,
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

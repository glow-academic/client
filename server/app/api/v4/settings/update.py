"""Settings update endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from app.sql.types import (
    UpdateSettingsApiRequest,
    UpdateSettingsApiResponse,
    UpdateSettingsSqlParams,
    UpdateSettingsSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/settings/update_settings_complete.sql"


router = APIRouter()


@router.post(
    "/update",
    response_model=UpdateSettingsApiResponse,
    dependencies=[
        audit_activity(
            "settings.updated",
            "{{ actor.name }} updated settings '{{ settings.name }}'",
        )
    ],
)
async def update_settings(
    request: UpdateSettingsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateSettingsApiResponse:
    """Update settings (creates new active row, deactivates old)."""
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

        async with transaction(conn):
            # Convert API request to SQL params using double star pattern
            # Frontend now sends arrays directly (provider_keys, auth_keys, etc.)
            # Pydantic handles UUID conversion automatically
            params = UpdateSettingsSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                UpdateSettingsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.settings_id:
                raise HTTPException(status_code=500, detail="Failed to update settings")

            settings_id = str(result.settings_id)
            settings_name = result.settings_name or request.name
            actor_name = result.actor_name

            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    settings={"name": settings_name, "id": settings_id},
                )

            # Convert SQL result to API response
            api_response = UpdateSettingsApiResponse.model_validate(
                {
                    "settings_id": result.settings_id,
                    "settings_name": settings_name,
                    "actor_name": actor_name,
                }
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            # Trigger Keycloak sync for affected departments
            from app.infra.v4.auth.keycloak_sync import perform_keycloak_sync

            if request.department_ids and len(request.department_ids) > 0:
                # Sync each affected department realm
                for dept_id in request.department_ids:
                    await perform_keycloak_sync(department_id=str(dept_id))
            else:
                # Global settings - sync default department (None)
                await perform_keycloak_sync(department_id=None)

            return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_settings",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

"""Setting delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.setting.permissions import compute_can_delete
from app.api.v4.artifacts.setting.types import (
    DeleteSettingApiRequest,
    DeleteSettingApiResponse,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckSettingDeleteAccessSqlParams,
    CheckSettingDeleteAccessSqlRow,
    DeleteSettingSqlParams,
    DeleteSettingSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/settings/check_setting_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/v4/queries/settings/delete_setting_complete.sql"

router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteSettingApiResponse,
    dependencies=[
        audit_activity(
            "setting.deleted",
            "{{ actor.name }} deleted setting '{{ setting.name }}'",
        )
    ],
)
async def delete_setting(
    request: DeleteSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSettingApiResponse:
    """Delete a setting."""
    tags = ["settings"]

    sql_query = load_sql_query(DELETE_SQL_PATH)
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
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
        else:
            actor_name = None
            user_role = None

        # Extract user department IDs for permission checks
        user_department_ids: list[UUID] = [
            d.department_id
            for d in (resolved_context.departments if pool else [])
            if d.department_id
        ]

        # Permission check: get setting department_ids and name using typed SQL
        access_params = CheckSettingDeleteAccessSqlParams(
            profile_id=profile_id,
            setting_id=request.setting_id,
        )
        access_result = cast(
            CheckSettingDeleteAccessSqlRow,
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

        can_delete = compute_can_delete(
            user_role=user_role,
            user_department_ids=user_department_ids,
            setting_department_ids=access_result.setting_department_ids or [],
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this setting.",
            )

        async with conn.transaction():
            params = DeleteSettingSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                DeleteSettingSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result.setting_exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Setting not found: {request.setting_id}",
                )
            if not result.deleted:
                raise HTTPException(status_code=500, detail="Failed to delete setting")

            setting_name = result.name or "Unknown"

            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    setting={
                        "name": setting_name,
                        "id": str(request.setting_id),
                    },
                )

        # Convert SQL result to API response
        api_response = DeleteSettingApiResponse(
            success=True,
            message=f"Setting '{setting_name}' deleted successfully",
        )

        # Invalidate cache after transaction
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
            operation="delete_setting",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

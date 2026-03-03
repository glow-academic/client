"""Provider save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (provider_id = NULL) and update (provider_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.provider.permissions import (
    compute_can_create,
    compute_can_edit,
)
from app.v5.api.main.provider.types import (
    SaveProviderApiRequest,
    SaveProviderApiResponse,
    SaveProviderSqlParams,
    SaveProviderSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.sql.types import (
    CheckProviderSaveAccessSqlParams,
    CheckProviderSaveAccessSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/v5/sql/queries/providers/check_provider_save_access_complete.sql"
)
SQL_PATH = "app/v5/sql/queries/providers/save_provider_complete.sql"

router = APIRouter()


@router.post("/save", response_model=SaveProviderApiResponse)
async def save_provider(
    request: SaveProviderApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveProviderApiResponse:
    """Save provider - handles both create (provider_id = NULL) and update (provider_id provided)."""
    tags = ["providers"]

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
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission check: get user role and provider info using typed SQL
        access_params = CheckProviderSaveAccessSqlParams(
            profile_id=profile_id,
            provider_id=request.input_provider_id,
        )
        access_result = cast(
            CheckProviderSaveAccessSqlRow,
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
        if not request.input_provider_id:
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=request.department_ids,
            )
        else:
            can_save_result = compute_can_edit(
                user_role=user_role,
                provider_department_ids=access_result.provider_department_ids,
                active_model_count=access_result.model_usage_count or 0,
                user_department_ids=user_department_ids,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this provider.",
            )

        async with conn.transaction():
            # Server-resolved group_id
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry DEFAULT VALUES RETURNING id"
            )

            # Convert flat IDs to SQL params
            params = SaveProviderSqlParams.from_request(
                request, profile_id=profile_id, group_id=group_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                SaveProviderSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.provider_id:
                if request.input_provider_id:
                    raise ValueError(f"Provider not found: {request.input_provider_id}")
                else:
                    raise ValueError("Failed to create provider")

        # Convert SQL result to API response
        is_update = request.input_provider_id is not None
        api_response = SaveProviderApiResponse.model_validate(
            {
                "success": True,
                "provider_id": str(result.provider_id),
                "message": "Provider updated successfully"
                if is_update
                else "Provider created successfully",
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
            operation="save_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

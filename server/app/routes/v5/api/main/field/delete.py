"""Field delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.field.permissions import compute_can_delete
from app.routes.v5.api.main.field.types import (
    DeleteFieldApiRequest,
    DeleteFieldApiResponse,
)
from app.sql.types import (
    CheckFieldDeleteAccessSqlParams,
    CheckFieldDeleteAccessSqlRow,
    DeleteFieldSqlParams,
    DeleteFieldSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = "app/sql/queries/fields/check_field_delete_access_complete.sql"
DELETE_SQL_PATH = "app/sql/queries/fields/delete_field_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteFieldApiResponse)
async def delete_field(
    request: DeleteFieldApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteFieldApiResponse:
    """Delete a field."""
    tags = ["fields"]

    sql_query = load_sql_query(DELETE_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
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
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role and field info using typed SQL
        access_params = CheckFieldDeleteAccessSqlParams(
            profile_id=profile_id,
            field_id=request.field_id,
        )
        access_result = cast(
            CheckFieldDeleteAccessSqlRow,
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
            field_department_ids=access_result.field_department_ids,
            active_parameter_count=access_result.active_parameter_count or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this field.",
            )

        async with conn.transaction():
            params = DeleteFieldSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            result = cast(
                DeleteFieldSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to check field usage")

            usage_count = result.usage_count or 0
            if usage_count > 0:
                raise ValueError("Cannot delete field that is in use by parameters")

            if not result.deleted:
                raise ValueError(f"Field not found: {request.field_id}")

            field_name = result.name or "Unknown"

        # Convert SQL result to API response
        api_response = DeleteFieldApiResponse.model_validate(
            {
                "success": True,
                "message": f"Field '{field_name}' deleted successfully",
            }
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags, redis=get_redis_client())
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
            operation="delete_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

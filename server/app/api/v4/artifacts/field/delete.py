"""Field delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.field.permissions import compute_can_delete
from app.api.v4.artifacts.field.types import (
    DeleteFieldApiRequest,
    DeleteFieldApiResponse,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckFieldDeleteAccessSqlParams,
    CheckFieldDeleteAccessSqlRow,
    DeleteFieldSqlParams,
    DeleteFieldSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/fields/check_field_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/v4/queries/fields/delete_field_complete.sql"


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteFieldApiResponse,
    dependencies=[
        audit_activity(
            "field.deleted", "{{ actor.name }} deleted field '{{ field.name }}'"
        )
    ],
)
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
            total_parameter_links=access_result.total_parameter_links or 0,
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

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    field={"name": field_name, "id": str(request.field_id)},
                )

        # Convert SQL result to API response
        api_response = DeleteFieldApiResponse.model_validate(
            {
                "success": True,
                "message": f"Field '{field_name}' deleted successfully",
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
            operation="delete_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

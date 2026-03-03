"""Model delete endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.model.permissions import compute_can_delete
from app.routes.v5.api.main.model.types import (
    DeleteModelApiRequest,
    DeleteModelApiResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckModelDeleteAccessSqlParams,
    CheckModelDeleteAccessSqlRow,
    DeleteModelSqlParams,
    DeleteModelSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/models/check_model_delete_access_complete.sql"
)
DELETE_SQL_PATH = "app/sql/queries/models/delete_model_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteModelApiResponse)
async def delete_model(
    request: DeleteModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteModelApiResponse:
    """Delete a model if not in use."""
    tags = ["models"]  # From router tags

    sql_query = load_sql_query(DELETE_SQL_PATH)
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
        else:
            actor_name = None
            user_role = None

        # Permission check: get user role and model info using typed SQL
        access_params = CheckModelDeleteAccessSqlParams(
            profile_id=profile_id,
            model_id=request.model_id,
        )
        access_result = cast(
            CheckModelDeleteAccessSqlRow,
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
            model_department_ids=access_result.model_department_ids,
            active_agent_count=access_result.active_agent_count or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this model.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DeleteModelSqlParams(**request.model_dump(), profile_id=profile_id)
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                DeleteModelSqlRow,
                await execute_sql_typed(
                    conn,
                    DELETE_SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to check model usage")

            if not result.deleted:
                raise ValueError(f"Model not found: {request.model_id}")

            model_name = result.name or "Unknown"

        # Convert SQL result to API response
        api_response = DeleteModelApiResponse.model_validate(
            {
                "success": True,
                "message": f"Model '{model_name}' deleted successfully",
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
            operation="delete_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

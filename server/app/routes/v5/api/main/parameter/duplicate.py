"""Parameter duplicate endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.parameter.permissions import compute_can_duplicate
from app.routes.v5.api.main.parameter.types import (
    DuplicateParameterApiRequest,
    DuplicateParameterApiResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    CheckParameterDuplicateAccessSqlParams,
    CheckParameterDuplicateAccessSqlRow,
    DuplicateParameterSqlParams,
    DuplicateParameterSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/parameters/check_parameter_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/sql/queries/parameters/duplicate_parameter_complete.sql"

router = APIRouter()


@router.post("/duplicate", response_model=DuplicateParameterApiResponse)
async def duplicate_parameter(
    request: DuplicateParameterApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateParameterApiResponse:
    """Duplicate a parameter."""
    tags = ["parameters", "agents"]

    sql_query = load_sql_query(DUPLICATE_SQL_PATH)
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

        # Permission check: get user role using typed SQL
        access_params = CheckParameterDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckParameterDuplicateAccessSqlRow,
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

        can_duplicate = compute_can_duplicate(user_role=user_role)

        if not can_duplicate:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to duplicate this parameter.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            params = DuplicateParameterSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                DuplicateParameterSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.parameter_id:
                raise ValueError(f"Parameter not found: {request.parameter_id}")

            original_name = result.original_name or "Unknown"

            # Convert SQL result to API response
            api_response = DuplicateParameterApiResponse.model_validate(
                {
                    "success": True,
                    "parameter_id": str(result.parameter_id),
                    "message": f"Parameter '{original_name}' duplicated successfully",
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
            operation="duplicate_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

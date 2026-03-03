"""Model duplicate endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.model.permissions import compute_can_duplicate
from app.v5.api.main.model.types import (
    DuplicateModelApiRequest,
    DuplicateModelApiResponse,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.resources.names.create import create_names_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.sql.types import (
    CheckModelDuplicateAccessSqlParams,
    CheckModelDuplicateAccessSqlRow,
    DuplicateModelSqlParams,
    DuplicateModelSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/v5/sql/queries/models/check_model_duplicate_access_complete.sql"
)
DUPLICATE_SQL_PATH = "app/v5/sql/queries/models/duplicate_model_complete.sql"

router = APIRouter()


@router.post("/duplicate", response_model=DuplicateModelApiResponse)
async def duplicate_model(
    request: DuplicateModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateModelApiResponse:
    """Duplicate a model."""
    tags = ["models"]  # From router tags

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
        access_params = CheckModelDuplicateAccessSqlParams(
            profile_id=profile_id,
            model_id=request.model_id,
        )
        access_result = cast(
            CheckModelDuplicateAccessSqlRow,
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
                detail="You don't have permission to duplicate this model.",
            )

        # Phase 1: Python creates name resource (Rule 4: Python creates, not SQL)
        original_name = access_result.original_name or "Unknown"
        new_name = f"{original_name} Copy"
        name_resource_id = await create_names_internal(conn, new_name)

        async with conn.transaction():
            # Phase 2: SQL creates artifact + links junctions
            params = DuplicateModelSqlParams(
                model_id=request.model_id,
                profile_id=profile_id,
                name_resource_id=name_resource_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper
            result = cast(
                DuplicateModelSqlRow,
                await execute_sql_typed(
                    conn,
                    DUPLICATE_SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.model_id:
                raise ValueError(f"Model not found: {request.model_id}")

            # Convert SQL result to API response
            api_response = DuplicateModelApiResponse.model_validate(
                {
                    "success": True,
                    "model_id": str(result.model_id),
                    "message": f"Model '{original_name}' duplicated successfully",
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
            operation="duplicate_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

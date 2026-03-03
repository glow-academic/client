"""Profile bulk delete endpoint - bulk delete profiles."""

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.sql.types import (
    BulkDeleteProfilesApiRequest,
    BulkDeleteProfilesApiResponse,
    BulkDeleteProfilesSqlParams,
    BulkDeleteProfilesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/profiles/bulk_delete_profiles_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=BulkDeleteProfilesApiResponse)
async def delete_profiles(
    request: BulkDeleteProfilesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteProfilesApiResponse:
    """Bulk delete profiles."""
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
        else:
            actor_name = None

        # Convert API request to SQL params (add profile_id from header)
        # Use double-star pattern
        params = BulkDeleteProfilesSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            BulkDeleteProfilesSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to delete profiles")

        deleted_count = result.deleted_count or 0

        if deleted_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No profiles could be deleted",
            )

        # Return auto-generated response type
        result_data = BulkDeleteProfilesApiResponse(
            deleted_count=deleted_count,
            actor_name=actor_name,
        )

        # Invalidate cache after mutation
        tags = ["profile"]
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_profiles",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

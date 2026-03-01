"""Attempts bulk archive endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    BulkArchiveAttemptsApiRequest,
    BulkArchiveAttemptsApiResponse,
    BulkArchiveAttemptsSqlParams,
    BulkArchiveAttemptsSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/attempts/bulk_archive_attempts_complete.sql"

router = APIRouter()


@router.post("/archive", response_model=BulkArchiveAttemptsApiResponse)
async def archive_attempts(
    request: BulkArchiveAttemptsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkArchiveAttemptsApiResponse:
    """Bulk archive or unarchive attempts (simulation or benchmark)."""
    tags = ["attempts"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=current_profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
        else:
            actor_name = None

        # Validate request - function determines mode based on attempt_ids
        # If attempt_ids is provided and non-empty, use attempt_ids mode
        # Otherwise, use filter mode (requires start_date and end_date)
        use_attempt_ids_mode = request.attempt_ids and len(request.attempt_ids) > 0

        if not use_attempt_ids_mode:
            # Filter mode requires start_date and end_date
            if not request.start_date or not request.end_date:
                raise HTTPException(
                    status_code=400,
                    detail="start_date and end_date are required when using filter-based archive",
                )

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern - function handles defaults via NULL checks
        params = BulkArchiveAttemptsSqlParams(
            **request.model_dump(), profile_id=current_profile_id
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            BulkArchiveAttemptsSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        updated_count = result.updated_count or 0
        count = int(updated_count)

        # Invalidate cache after mutation
        invalidation_tags = tags + ["dashboard"]

        # Use profile_ids_to_invalidate from function result
        profile_ids_to_invalidate = result.profile_ids_to_invalidate or []

        # Add profile-specific tags for each affected profileId
        for profile_id in profile_ids_to_invalidate:
            invalidation_tags.extend(
                [
                    f"home:profile:{profile_id}",
                    f"reports:profile:{profile_id}",
                    f"practice:profile:{profile_id}",
                    f"history:profile:{profile_id}",
                ]
            )

        await invalidate_tags(invalidation_tags)
        response.headers["X-Invalidate-Tags"] = ",".join(invalidation_tags)

        # Convert SQL result to API response
        api_response = BulkArchiveAttemptsApiResponse.model_validate(
            result.model_dump()
        )

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="archive_attempts",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

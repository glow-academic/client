"""Profile bulk save endpoint - bulk create or update profiles (upsert)."""

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool, transaction
from app.sql.types import (
    UpsertProfilesApiRequest,
    UpsertProfilesApiResponse,
    UpsertProfilesSqlParams,
    UpsertProfilesSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/profiles/upsert_profiles_complete.sql"

router = APIRouter()


@router.post("/save", response_model=UpsertProfilesApiResponse)
async def save_profiles(
    request: UpsertProfilesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpsertProfilesApiResponse:
    """Bulk create or update profiles (upsert)."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get current user's profile_id from header (set by router-level dependency)
        current_profile_id = http_request.state.profile_id
        if not current_profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for session_id
        session_id = None
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=current_profile_id,
                    bypass_cache=False,
                )
                session_id = profile_ctx.session_id

        # Validate all profiles before processing
        for i, profile_req in enumerate(request.profiles):
            if not profile_req.emails or len(profile_req.emails) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Profile {i + 1} must have at least one email",
                )
            primary_index = (
                profile_req.primary_email_index
                if profile_req.primary_email_index is not None
                else 0
            )
            if primary_index < 0 or primary_index >= len(profile_req.emails):
                raise HTTPException(
                    status_code=400,
                    detail=f"Profile {i + 1} has invalid primary_email_index",
                )

        # Convert API request to SQL params (add current_profile_id from header)
        # Use double-star pattern - SQL handles bulk operation
        # current_profile_id comes from header, will override if accidentally in request
        params = UpsertProfilesSqlParams(
            **request.model_dump(),
            current_profile_id=uuid.UUID(current_profile_id),
            session_id=session_id,
        )
        sql_params = params.to_tuple()

        async with transaction(conn):
            # Execute query with typed helper - SQL handles bulk upsert
            result = cast(
                UpsertProfilesSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result:
                raise ValueError("Failed to bulk save profiles")

        # Convert SQL result to API response
        api_response = UpsertProfilesApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        tags = ["profile"]
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_profiles",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

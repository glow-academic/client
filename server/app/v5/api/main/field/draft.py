"""Field draft endpoint - handles autosave for all field resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.field.permissions import compute_can_draft
from app.v5.api.main.field.types import (
    PatchFieldDraftApiRequest,
    PatchFieldDraftApiResponse,
    PatchFieldDraftSqlParams,
    PatchFieldDraftSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckFieldDuplicateAccessSqlParams,
    CheckFieldDuplicateAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/fields/check_field_duplicate_access_complete.sql"
)
SQL_PATH = "app/sql/queries/fields/patch_field_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchFieldDraftApiResponse,
)
async def patch_field_draft(
    request: PatchFieldDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchFieldDraftApiResponse:
    """Patch field draft - accepts resource IDs and creates/updates draft."""
    tags = ["fields", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
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
                user_role = profile_ctx.access.role
        else:
            user_role = None

        # Permission check: get user role using typed SQL
        access_params = CheckFieldDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckFieldDuplicateAccessSqlRow,
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

        # Permission check using centralized permissions logic
        can_draft_result = compute_can_draft(user_role=user_role)

        if not can_draft_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or edit field drafts.",
            )

        async with conn.transaction():
            params = PatchFieldDraftSqlParams.from_request(
                request,
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchFieldDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch field draft")

        # Build response with success and message
        is_update = request.input_draft_id is not None
        api_response = PatchFieldDraftApiResponse.model_validate(
            {
                "success": True,
                "draft_id": str(result.draft_id),
                "new_version": result.new_version,
                "message": "Draft updated successfully"
                if is_update
                else "Draft created successfully",
            }
        )

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
            operation="patch_field_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

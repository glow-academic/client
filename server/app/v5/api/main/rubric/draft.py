"""Rubric draft endpoint - handles autosave for all rubric resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.rubric.permissions import compute_can_draft
from app.v5.api.main.rubric.types import (
    PatchRubricDraftApiRequest,
    PatchRubricDraftApiResponse,
    PatchRubricDraftSqlParams,
    PatchRubricDraftSqlRow,
)
from app.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckRubricDuplicateAccessSqlParams,
    CheckRubricDuplicateAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths - reuse duplicate access check (only needs user_role)
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/rubrics/check_rubric_duplicate_access_complete.sql"
)
SQL_PATH = "app/sql/queries/rubrics/patch_rubric_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchRubricDraftApiResponse,
)
async def patch_rubric_draft(
    request: PatchRubricDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchRubricDraftApiResponse:
    """Patch rubric draft - accepts resource IDs and creates/updates draft."""
    tags = ["rubrics", "drafts"]

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
        access_params = CheckRubricDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckRubricDuplicateAccessSqlRow,
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

        can_draft_result = compute_can_draft(user_role=user_role)

        if not can_draft_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or edit rubric drafts.",
            )

        async with conn.transaction():
            params = PatchRubricDraftSqlParams.from_request(request, profile_id)
            sql_params = params.to_tuple()

            result = cast(
                PatchRubricDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch rubric draft")

        is_update = request.input_draft_id is not None
        api_response = PatchRubricDraftApiResponse.model_validate(
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
            operation="patch_rubric_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

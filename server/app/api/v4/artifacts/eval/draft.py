"""Eval draft endpoint - handles autosave for all eval resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.eval.permissions import compute_can_draft
from app.api.v4.artifacts.eval.types import (
    PatchEvalDraftApiRequest,
    PatchEvalDraftApiResponse,
    PatchEvalDraftSqlParams,
    PatchEvalDraftSqlRow,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckEvalDuplicateAccessSqlParams,
    CheckEvalDuplicateAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/evals/check_eval_duplicate_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/evals/patch_eval_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchEvalDraftApiResponse,
)
async def patch_eval_draft(
    request: PatchEvalDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchEvalDraftApiResponse:
    """Patch eval draft - accepts resource IDs and creates/updates draft."""
    tags = ["evals", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
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
                user_role = resolved_context.user_role
        else:
            user_role = None

        # Permission check: get user role using typed SQL
        access_params = CheckEvalDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckEvalDuplicateAccessSqlRow,
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
                detail="You don't have permission to create or edit eval drafts.",
            )

        async with conn.transaction():
            params = PatchEvalDraftSqlParams.from_request(
                request=request,
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchEvalDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch eval draft")

            audit_set(
                http_request,
                actor={"id": profile_id},
                draft={"id": str(result.draft_id)},
            )

        # Build response with success and message
        is_update = request.input_draft_id is not None
        api_response = PatchEvalDraftApiResponse.model_validate(
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
            operation="patch_eval_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

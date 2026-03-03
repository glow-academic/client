"""Department draft endpoint - handles autosave for all department resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.department.permissions import compute_can_draft
from app.v5.api.main.department.types import (
    PatchDepartmentDraftApiRequest,
    PatchDepartmentDraftApiResponse,
    PatchDepartmentDraftSqlParams,
    PatchDepartmentDraftSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    CheckDepartmentDuplicateAccessSqlParams,
    CheckDepartmentDuplicateAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/queries/departments/check_department_duplicate_access_complete.sql"
)
SQL_PATH = "app/sql/queries/departments/patch_department_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchDepartmentDraftApiResponse,
)
async def patch_department_draft(
    request: PatchDepartmentDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchDepartmentDraftApiResponse:
    """Patch department draft - accepts resource IDs and creates/updates draft."""
    tags = ["departments", "drafts"]

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
        access_params = CheckDepartmentDuplicateAccessSqlParams(
            profile_id=profile_id,
        )
        access_result = cast(
            CheckDepartmentDuplicateAccessSqlRow,
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
                detail="You don't have permission to create or edit department drafts.",
            )

        async with conn.transaction():
            params = PatchDepartmentDraftSqlParams.from_request(
                request,
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchDepartmentDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch department draft")

        # Build response
        is_update = request.input_draft_id is not None
        api_response = PatchDepartmentDraftApiResponse(
            success=True,
            draft_id=result.draft_id,
            new_version=result.new_version,
            message="Draft updated successfully"
            if is_update
            else "Draft created successfully",
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
            operation="patch_department_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

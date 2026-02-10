"""Model draft endpoint - handles autosave for all model resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.model.permissions import compute_can_draft
from app.api.v4.artifacts.model.types import (
    PatchModelDraftApiRequest,
    PatchModelDraftApiResponse,
    PatchModelDraftSqlParams,
)
from app.infra.v4.activity.audit import audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CheckModelDuplicateAccessSqlParams,
    CheckModelDuplicateAccessSqlRow,
    PatchModelDraftSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths — reuses the duplicate access check (only needs user_role)
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/models/check_model_duplicate_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/models/patch_model_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchModelDraftApiResponse,
)
async def patch_model_draft(
    request: PatchModelDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchModelDraftApiResponse:
    """Patch model draft - accepts resource IDs and creates/updates draft."""
    tags = ["models", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Permission check: get user role using typed SQL
        access_params = CheckModelDuplicateAccessSqlParams(
            profile_id=profile_id,
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

        # Permission check using centralized permissions logic
        can_draft_result = compute_can_draft(user_role=access_result.user_role)

        if not can_draft_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or edit model drafts.",
            )

        async with conn.transaction():
            params = PatchModelDraftSqlParams.from_request(
                request, profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchModelDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch model draft")

            audit_set(
                http_request,
                actor={"id": profile_id},
                draft={"id": str(result.draft_id)},
            )

        if not result.draft_id or result.new_version is None:
            raise ValueError("Failed to patch model draft — missing draft_id or version")

        api_response = PatchModelDraftApiResponse(
            success=True,
            draft_id=result.draft_id,
            new_version=result.new_version,
            message="Draft saved successfully",
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
            operation="patch_model_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

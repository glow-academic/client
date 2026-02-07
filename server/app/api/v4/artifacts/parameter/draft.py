"""Parameter draft endpoint - handles autosave for all parameter resources."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.parameter.permissions import compute_can_draft
from app.api.v4.artifacts.parameter.types import (
    PatchParameterDraftApiRequest,
    PatchParameterDraftApiResponse,
)
from app.infra.v4.activity.audit import audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CheckParameterDuplicateAccessSqlParams,
    CheckParameterDuplicateAccessSqlRow,
    PatchParameterDraftSqlParams,
    PatchParameterDraftSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/parameters/check_parameter_duplicate_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/parameters/patch_parameter_draft_complete.sql"

router = APIRouter()


@router.patch(
    "/draft",
    response_model=PatchParameterDraftApiResponse,
)
async def patch_parameter_draft(
    request: PatchParameterDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchParameterDraftApiResponse:
    """Patch parameter draft - accepts resource IDs and creates/updates draft."""
    tags = ["parameters", "drafts"]

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

        # Permission check using centralized permissions logic
        can_draft_result = compute_can_draft(user_role=access_result.user_role)

        if not can_draft_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or edit parameter drafts.",
            )

        async with conn.transaction():
            params = PatchParameterDraftSqlParams(
                **request.model_dump(), profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchParameterDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch parameter draft")

            audit_set(
                http_request,
                actor={"id": profile_id},
                draft={"id": str(result.draft_id)},
            )

        # Build response with success and message
        is_update = request.input_draft_id is not None
        api_response = PatchParameterDraftApiResponse.model_validate(
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
            operation="patch_parameter_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

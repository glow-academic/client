"""Profile save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_profile_id = NULL) and update (input_profile_id provided).
Two-pass architecture: access check SQL → Python permissions → mutation SQL.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.profile.permissions import (
    compute_can_create,
    compute_can_save,
)
from app.api.v4.artifacts.profile.types import (
    PatchProfileDraftApiRequest,
    PatchProfileDraftSqlParams,
    PatchProfileDraftSqlRow,
    SaveProfileRouteApiRequest,
    SaveProfileRouteApiResponse,
    SaveProfileSqlParams,
    SaveProfileSqlRow,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    CheckProfileSaveAccessSqlParams,
    CheckProfileSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_CHECK_SQL_PATH = (
    "app/sql/v4/queries/profile/check_profile_save_access_complete.sql"
)
SQL_PATH = "app/sql/v4/queries/profile/save_profile_complete.sql"
PATCH_SQL_PATH = "app/sql/v4/queries/profile/patch_profile_draft_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveProfileRouteApiResponse,
    dependencies=[
        audit_activity(
            "profile.saved",
            "{{ actor.name }} {% if profile %}updated{% else %}created{% endif %} profile{% if profile %} '{{ profile.name }}'{% endif %}",
        )
    ],
)
async def save_profile(
    request: SaveProfileRouteApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveProfileRouteApiResponse:
    """Save profile - handles both create and update via nested resource actions."""
    tags = ["profile"]

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
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
                user_department_ids = [
                    d.department_id
                    for d in resolved_context.departments
                    if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Permission check: get user role and department info
        access_params = CheckProfileSaveAccessSqlParams(
            profile_id=profile_id,
            input_profile_id=request.input_profile_id,
        )
        access_result = cast(
            CheckProfileSaveAccessSqlRow,
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

        # Permission logic: create vs update mode
        if not request.input_profile_id:
            can_save_result = compute_can_create(
                user_role=user_role,
                department_ids=None,
            )
        else:
            can_save_result = compute_can_save(
                user_role=user_role,
                user_department_ids=user_department_ids,
                target_department_ids=access_result.target_department_ids,
            )

        if not can_save_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to save this profile.",
            )

        async with conn.transaction():
            # Persona parity: save always receives nested resource actions.
            # We patch/create draft from these actions, then persist from that draft.
            patch_request = PatchProfileDraftApiRequest(
                input_draft_id=None,
                group_id=request.group_id,
                role=request.role,
                names=request.names,
                flags=request.flags,
                request_limits=request.request_limits,
                departments=request.departments,
                emails=request.emails,
                cohorts=request.cohorts,
                expected_version=request.expected_version,
            )
            patch_params = PatchProfileDraftSqlParams.from_request(
                patch_request, profile_id=profile_id
            )
            patch_result = cast(
                PatchProfileDraftSqlRow,
                await execute_sql_typed(
                    conn,
                    PATCH_SQL_PATH,
                    params=patch_params,
                ),
            )
            resolved_draft_id = patch_result.draft_id if patch_result else None

            if not resolved_draft_id:
                raise ValueError("Failed to prepare profile draft for save.")

            params = SaveProfileSqlParams(
                draft_id=resolved_draft_id,
                actor_profile_id=profile_id,
                input_profile_id=request.input_profile_id,
            )
            sql_params = params.to_tuple()

            result = cast(
                SaveProfileSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.profile_id:
                if request.input_profile_id:
                    raise ValueError(f"Profile not found: {request.input_profile_id}")
                else:
                    raise ValueError("Failed to create profile")

            # Set audit context
            if actor_name:
                audit_ctx = {"actor": {"name": actor_name, "id": profile_id}}
                audit_ctx["profile"] = {"id": str(result.profile_id)}
                audit_set(http_request, **audit_ctx)

        is_update = request.input_profile_id is not None
        api_response = SaveProfileRouteApiResponse.model_validate(
            {
                "success": True,
                "profile_id": str(result.profile_id),
                "message": "Profile updated successfully"
                if is_update
                else "Profile created successfully",
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
            operation="save_profile",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

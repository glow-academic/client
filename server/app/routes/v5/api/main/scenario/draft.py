"""Scenario draft endpoint - handles autosave for all scenario resources."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.scenario.permissions import (
    SCENARIO_RESOURCES,
    compute_can_draft,
)
from app.routes.v5.api.main.scenario.types import (
    PatchScenarioDraftApiRequest,
    PatchScenarioDraftApiResponse,
    PatchScenarioDraftSqlParams,
    PatchScenarioDraftSqlRow,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.entries.scenario_drafts.refresh import refresh_scenario_drafts_internal
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.api.resources.departments.link import link_departments_internal
from app.routes.v5.api.resources.descriptions.link import link_descriptions_internal
from app.routes.v5.api.resources.documents.link import link_documents_internal
from app.routes.v5.api.resources.flags.link import link_flags_internal
from app.routes.v5.api.resources.images.link import link_images_internal
from app.routes.v5.api.resources.names.link import link_names_internal
from app.routes.v5.api.resources.objectives.link import link_objectives_internal
from app.routes.v5.api.resources.options.link import link_options_internal
from app.routes.v5.api.resources.parameter_fields.link import link_parameter_fields_internal
from app.routes.v5.api.resources.personas.link import link_personas_internal
from app.routes.v5.api.resources.problem_statements.link import (
    link_problem_statements_internal,
)
from app.routes.v5.api.resources.questions.link import link_questions_internal
from app.routes.v5.api.resources.videos.link import link_videos_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/sql/queries/scenarios/patch_scenario_draft_complete.sql"

# Single-select resource key → link internal function
SINGLE_LINK_MAP: dict[str, Any] = {
    "names": link_names_internal,
    "descriptions": link_descriptions_internal,
    "problem_statements": link_problem_statements_internal,
    "flags": link_flags_internal,
}

# Multi-select resource key → link internal function
MULTI_LINK_MAP: dict[str, Any] = {
    "departments": link_departments_internal,
    "personas": link_personas_internal,
    "documents": link_documents_internal,
    "parameter_fields": link_parameter_fields_internal,
    "images": link_images_internal,
    "objectives": link_objectives_internal,
    "videos": link_videos_internal,
    "questions": link_questions_internal,
    "options": link_options_internal,
}

# Request field → resource key mapping (for single-select)
SINGLE_REQUEST_FIELDS: dict[str, str] = {
    "name_id": "names",
    "description_id": "descriptions",
    "problem_statement_id": "problem_statements",
    "active_flag_id": "flags",
    "objectives_enabled_flag_id": "flags",
    "images_enabled_flag_id": "flags",
    "video_enabled_flag_id": "flags",
    "questions_enabled_flag_id": "flags",
    "problem_statement_enabled_flag_id": "flags",
}

# Request field → resource key mapping (for multi-select)
MULTI_REQUEST_FIELDS: dict[str, str] = {
    "department_ids": "departments",
    "persona_ids": "personas",
    "document_ids": "documents",
    "parameter_field_ids": "parameter_fields",
    "image_ids": "images",
    "objective_ids": "objectives",
    "video_ids": "videos",
    "question_ids": "questions",
    "option_ids": "options",
}

router = APIRouter()


async def _link_draft_resources(
    conn: asyncpg.Connection,
    request: PatchScenarioDraftApiRequest,
    group_id: UUID,
    link_tool_ids: dict[str, UUID | None],
) -> None:
    """Call link_*_internal for each resource that changed in the draft request.

    Only links resources where both a resource_id and a link_tool_id are available.
    Errors are logged but do not fail the draft save.
    """
    # Single-select resources
    for field, resource_key in SINGLE_REQUEST_FIELDS.items():
        resource_id = getattr(request, field, None)
        if resource_id is None:
            continue
        tool_id = link_tool_ids.get(resource_key)
        if tool_id is None:
            continue
        link_fn = SINGLE_LINK_MAP.get(resource_key)
        if link_fn:
            try:
                await link_fn(
                    conn, resource_id=resource_id, group_id=group_id, tool_id=tool_id
                )
            except Exception as e:
                logger.warning(f"link_{resource_key}_internal failed (non-fatal): {e}")

    # Multi-select resources
    for field, resource_key in MULTI_REQUEST_FIELDS.items():
        resource_ids = getattr(request, field, None)
        if not resource_ids:
            continue
        tool_id = link_tool_ids.get(resource_key)
        if tool_id is None:
            continue
        link_fn = MULTI_LINK_MAP.get(resource_key)
        if link_fn:
            for rid in resource_ids:
                try:
                    await link_fn(
                        conn, resource_id=rid, group_id=group_id, tool_id=tool_id
                    )
                except Exception as e:
                    logger.warning(
                        f"link_{resource_key}_internal failed for {rid} (non-fatal): {e}"
                    )


@router.patch(
    "/draft",
    response_model=PatchScenarioDraftApiResponse,
)
async def patch_scenario_draft(
    request: PatchScenarioDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchScenarioDraftApiResponse:
    """Patch scenario draft - accepts resource IDs and creates/updates draft."""
    tags = ["scenarios", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context for permissions
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

        # Permission check using centralized permissions logic
        if not compute_can_draft(user_role=user_role):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or edit scenario drafts.",
            )

        # Resolve link tool IDs from settings (for tool tracking)
        link_tool_ids: dict[str, UUID | None] | None = None
        if request.group_id and pool:
            async with pool.acquire() as settings_conn:
                settings_data = await get_auth_settings_internal(
                    settings_conn, profile_id, bypass_cache=False
                )
            _, _, link_tool_ids = resolve_agents_for_artifact(
                settings_data.agent_tool_entries, SCENARIO_RESOURCES
            )

        async with conn.transaction():
            params = PatchScenarioDraftSqlParams.from_request(
                request, profile_id=profile_id, group_id=request.group_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchScenarioDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch scenario draft")

        # Link resources for tool tracking (after successful draft save)
        if request.group_id and link_tool_ids:
            await _link_draft_resources(conn, request, request.group_id, link_tool_ids)

        is_update = request.input_draft_id is not None
        api_response = PatchScenarioDraftApiResponse.model_validate(
            {
                "success": True,
                "draft_id": str(result.draft_id),
                "new_version": result.new_version,
                "message": "Draft updated successfully"
                if is_update
                else "Draft created successfully",
            }
        )

        # Refresh MV so /auth/drafts can see the new draft immediately
        await refresh_scenario_drafts_internal(conn)

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
            operation="patch_scenario_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

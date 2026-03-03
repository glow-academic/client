"""Persona draft endpoint - handles autosave for all persona resources."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.persona.permissions import (
    PERSONA_RESOURCES,
    compute_can_draft,
)
from app.v5.api.main.persona.types import (
    PatchPersonaDraftApiRequest,
    PatchPersonaDraftApiResponse,
    PatchPersonaDraftSqlParams,
    PatchPersonaDraftSqlRow,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.auth.settings import get_auth_settings_internal
from app.v5.api.entries.persona_drafts.refresh import refresh_persona_drafts_internal
from app.v5.api.permissions import resolve_agents_for_artifact
from app.v5.api.resources.colors.link import link_colors_internal
from app.v5.api.resources.departments.link import link_departments_internal
from app.v5.api.resources.descriptions.link import link_descriptions_internal
from app.v5.api.resources.examples.link import link_examples_internal
from app.v5.api.resources.flags.link import link_flags_internal
from app.v5.api.resources.icons.link import link_icons_internal
from app.v5.api.resources.instructions.link import link_instructions_internal
from app.v5.api.resources.names.link import link_names_internal
from app.v5.api.resources.parameter_fields.link import link_parameter_fields_internal
from app.v5.api.resources.voices.link import link_voices_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
SQL_PATH = "app/v5/sql/queries/personas/patch_persona_draft_complete.sql"

# Single-select resource key → link internal function
SINGLE_LINK_MAP: dict[str, Any] = {
    "names": link_names_internal,
    "descriptions": link_descriptions_internal,
    "colors": link_colors_internal,
    "icons": link_icons_internal,
    "instructions": link_instructions_internal,
    "flags": link_flags_internal,
}

# Multi-select resource key → link internal function
MULTI_LINK_MAP: dict[str, Any] = {
    "departments": link_departments_internal,
    "parameter_fields": link_parameter_fields_internal,
    "examples": link_examples_internal,
    "voices": link_voices_internal,
}

# Request field → resource key mapping (for single-select)
SINGLE_REQUEST_FIELDS: dict[str, str] = {
    "name_id": "names",
    "description_id": "descriptions",
    "color_id": "colors",
    "icon_id": "icons",
    "instructions_id": "instructions",
    "active_flag_id": "flags",
}

# Request field → resource key mapping (for multi-select)
MULTI_REQUEST_FIELDS: dict[str, str] = {
    "department_ids": "departments",
    "parameter_field_ids": "parameter_fields",
    "example_ids": "examples",
    "voice_ids": "voices",
}

router = APIRouter()


async def patch_persona_draft_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    request: PatchPersonaDraftApiRequest,
    group_id: UUID | None = None,
    soft: bool = False,
) -> PatchPersonaDraftSqlRow:
    """Core draft patch logic — no transaction management or cache invalidation.

    Args:
        conn: Database connection (caller owns transaction).
        profile_id: The profile performing the action.
        request: The draft patch request with resource IDs.
        group_id: Optional group_id for tool tracking.
        soft: If True, creates dormant draft (active=false).

    Returns:
        PatchPersonaDraftSqlRow with draft_id, new_version, draft_exists.
    """
    active_value = not soft
    params = PatchPersonaDraftSqlParams.from_request(
        request, profile_id=profile_id, group_id=group_id, active_value=active_value
    )

    result = cast(
        PatchPersonaDraftSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result:
        raise ValueError("Failed to patch persona draft")

    return result


async def _link_draft_resources(
    conn: asyncpg.Connection,
    request: PatchPersonaDraftApiRequest,
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
    response_model=PatchPersonaDraftApiResponse,
)
async def patch_persona_draft(
    request: PatchPersonaDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchPersonaDraftApiResponse:
    """Patch persona draft - accepts resource IDs and creates/updates draft."""
    tags = ["personas", "drafts"]

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
        can_draft_result = compute_can_draft(user_role=user_role)

        if not can_draft_result:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or edit persona drafts.",
            )

        # Resolve link tool IDs from settings (for tool tracking)
        link_tool_ids: dict[str, UUID | None] | None = None
        if request.group_id and pool:
            async with pool.acquire() as settings_conn:
                settings_data = await get_auth_settings_internal(
                    settings_conn, profile_id, bypass_cache=False
                )
            _, _, link_tool_ids = resolve_agents_for_artifact(
                settings_data.agent_tool_entries, PERSONA_RESOURCES
            )

        async with conn.transaction():
            result = await patch_persona_draft_internal(
                conn,
                profile_id=profile_id,
                request=request,
                group_id=request.group_id,
            )

        # Link resources for tool tracking (after successful draft save)
        if request.group_id and link_tool_ids:
            await _link_draft_resources(conn, request, request.group_id, link_tool_ids)

        # Build response with success and message
        is_update = request.input_draft_id is not None
        api_response = PatchPersonaDraftApiResponse.model_validate(
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
        await refresh_persona_drafts_internal(conn)

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
            operation="patch_persona_draft",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )

"""Cohort draft endpoint - handles autosave for all cohort resources."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.cohort.permissions import COHORT_RESOURCES, compute_can_draft
from app.routes.v5.api.main.cohort.types import (
    PatchCohortDraftApiRequest,
    PatchCohortDraftApiResponse,
    PatchCohortDraftSqlParams,
    PatchCohortDraftSqlRow,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.entries.cohort_drafts.refresh import refresh_cohort_drafts_internal
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.api.resources.departments.link import link_departments_internal
from app.routes.v5.api.resources.descriptions.link import link_descriptions_internal
from app.routes.v5.api.resources.flags.link import link_flags_internal
from app.routes.v5.api.resources.names.link import link_names_internal
from app.routes.v5.api.resources.profile_personas.link import link_profile_personas_internal
from app.routes.v5.api.resources.profiles.link import link_profiles_internal
from app.routes.v5.api.resources.simulation_availability.link import (
    link_simulation_availability_internal,
)
from app.routes.v5.api.resources.simulation_positions.link import (
    link_simulation_positions_internal,
)
from app.routes.v5.api.resources.simulations.link import link_simulations_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/sql/queries/cohorts/patch_cohort_draft_complete.sql"

# Single-select resource key → link internal function
SINGLE_LINK_MAP: dict[str, Any] = {
    "names": link_names_internal,
    "descriptions": link_descriptions_internal,
    "flags": link_flags_internal,
}

# Multi-select resource key → link internal function
MULTI_LINK_MAP: dict[str, Any] = {
    "departments": link_departments_internal,
    "simulations": link_simulations_internal,
    "simulation_positions": link_simulation_positions_internal,
    "simulation_availability": link_simulation_availability_internal,
    "profiles": link_profiles_internal,
    "profile_personas": link_profile_personas_internal,
}

# Request field → resource key mapping (for single-select)
SINGLE_REQUEST_FIELDS: dict[str, str] = {
    "name_id": "names",
    "description_id": "descriptions",
    "flag_id": "flags",
}

# Request field → resource key mapping (for multi-select)
MULTI_REQUEST_FIELDS: dict[str, str] = {
    "department_ids": "departments",
    "simulation_ids": "simulations",
    "simulation_position_ids": "simulation_positions",
    "simulation_availability_ids": "simulation_availability",
    "profile_ids": "profiles",
    "profile_persona_ids": "profile_personas",
}

router = APIRouter()


async def _link_draft_resources(
    conn: asyncpg.Connection,
    request: PatchCohortDraftApiRequest,
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
    response_model=PatchCohortDraftApiResponse,
)
async def patch_cohort_draft(
    request: PatchCohortDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchCohortDraftApiResponse:
    """Patch cohort draft - accepts resource IDs and creates/updates draft."""
    tags = ["cohorts", "drafts"]

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
        if not compute_can_draft(user_role=user_role or ""):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or edit cohort drafts.",
            )

        # Resolve link tool IDs from settings (for tool tracking)
        link_tool_ids: dict[str, UUID | None] | None = None
        if request.group_id and pool:
            async with pool.acquire() as settings_conn:
                settings_data = await get_auth_settings_internal(
                    settings_conn, profile_id, bypass_cache=False
                )
            _, _, link_tool_ids = resolve_agents_for_artifact(
                settings_data.agent_tool_entries, COHORT_RESOURCES
            )

        async with conn.transaction():
            params = PatchCohortDraftSqlParams.from_request(
                request, profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchCohortDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch cohort draft")

        # Link resources for tool tracking (after successful draft save)
        if request.group_id and link_tool_ids:
            await _link_draft_resources(conn, request, request.group_id, link_tool_ids)

        api_response = PatchCohortDraftApiResponse.model_validate(result.model_dump())

        # Refresh MV so /auth/drafts can see the new draft immediately
        await refresh_cohort_drafts_internal(conn)

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
            operation="patch_cohort_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

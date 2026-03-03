"""Simulation draft endpoint - handles autosave for all simulation resources.

Uses Python-computed permissions for access control.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.simulation.permissions import (
    SIMULATION_RESOURCES,
    compute_can_draft,
)
from app.v5.api.main.simulation.types import (
    PatchSimulationDraftApiRequest,
    PatchSimulationDraftApiResponse,
    PatchSimulationDraftSqlParams,
)
from app.v5.api.auth.settings import get_auth_settings_internal
from app.v5.api.entries.simulation_drafts.refresh import (
    refresh_simulation_drafts_internal,
)
from app.v5.api.permissions import resolve_agents_for_artifact
from app.v5.api.resources.departments.link import link_departments_internal
from app.v5.api.resources.descriptions.link import link_descriptions_internal
from app.v5.api.resources.flags.link import link_flags_internal
from app.v5.api.resources.names.link import link_names_internal
from app.v5.api.resources.scenario_flags.link import link_scenario_flags_internal
from app.v5.api.resources.scenario_positions.link import (
    link_scenario_positions_internal,
)
from app.v5.api.resources.scenario_rubrics.link import link_scenario_rubrics_internal
from app.v5.api.resources.scenario_time_limits.link import (
    link_scenario_time_limits_internal,
)
from app.v5.api.resources.scenarios.link import link_scenarios_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    PatchSimulationDraftSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

SQL_PATH = "app/sql/queries/simulations/patch_simulation_draft_complete.sql"

# Single-select resource key → link internal function
SINGLE_LINK_MAP: dict[str, Any] = {
    "names": link_names_internal,
    "descriptions": link_descriptions_internal,
}

# Multi-select resource key → link internal function
MULTI_LINK_MAP: dict[str, Any] = {
    "flags": link_flags_internal,
    "departments": link_departments_internal,
    "scenarios": link_scenarios_internal,
    "scenario_flags": link_scenario_flags_internal,
    "scenario_positions": link_scenario_positions_internal,
    "scenario_rubrics": link_scenario_rubrics_internal,
    "scenario_time_limits": link_scenario_time_limits_internal,
}

# Request field → resource key mapping (for single-select)
SINGLE_REQUEST_FIELDS: dict[str, str] = {
    "name_id": "names",
    "description_id": "descriptions",
}

# Request field → resource key mapping (for multi-select)
MULTI_REQUEST_FIELDS: dict[str, str] = {
    "flag_ids": "flags",
    "department_ids": "departments",
    "scenario_ids": "scenarios",
    "scenario_flag_ids": "scenario_flags",
    "scenario_position_ids": "scenario_positions",
    "scenario_rubric_ids": "scenario_rubrics",
    "scenario_time_limit_ids": "scenario_time_limits",
}

router = APIRouter()


async def _link_draft_resources(
    conn: asyncpg.Connection,
    request: PatchSimulationDraftApiRequest,
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


@router.patch("/draft", response_model=PatchSimulationDraftApiResponse)
async def patch_simulation_draft(
    request: PatchSimulationDraftApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PatchSimulationDraftApiResponse:
    """Patch simulation draft - accepts resource IDs and creates/updates draft.

    Uses Python permission checks before executing draft operation.
    """
    tags = ["simulations", "drafts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        from app.v5.api.auth.profile import get_auth_profile_internal

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

        # Check draft permission using Python (role already fetched from profile context)
        if not compute_can_draft(user_role):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to create or modify drafts.",
            )

        # Resolve link tool IDs from settings (for tool tracking)
        link_tool_ids: dict[str, UUID | None] | None = None
        if request.group_id and pool:
            async with pool.acquire() as settings_conn:
                settings_data = await get_auth_settings_internal(
                    settings_conn, profile_id, bypass_cache=False
                )
            _, _, link_tool_ids = resolve_agents_for_artifact(
                settings_data.agent_tool_entries, SIMULATION_RESOURCES
            )

        async with conn.transaction():
            params = PatchSimulationDraftSqlParams.from_request(
                request, profile_id=profile_id
            )
            sql_params = params.to_tuple()

            result = cast(
                PatchSimulationDraftSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                raise ValueError("Failed to patch simulation draft")

        # Link resources for tool tracking (after successful draft save)
        if request.group_id and link_tool_ids:
            await _link_draft_resources(conn, request, request.group_id, link_tool_ids)

        api_response = PatchSimulationDraftApiResponse.model_validate(
            result.model_dump()
        )

        # Refresh MV so /auth/drafts can see the new draft immediately
        await refresh_simulation_drafts_internal(conn)

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
            operation="patch_simulation_draft",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

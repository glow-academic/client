"""Cohort get endpoint - Two-pass architecture with three-layer BFF.

This implements the refactored approach matching the persona gold standard:
1. Query 1: Access check (user context, cohort state)
2. Query 2: ID fetching (resource IDs, suggestions, agents, tool IDs)
3. Pass 2: Parallel resource fetching (per-resource caching)

Three output layers:
- get_cohort_internal() -> CohortInternalData (shared dataclass)
- get_cohort_websocket() -> GetCohortWebsocketResponse (minimal, for AI generation)
- get_cohort_client() -> GetCohortApiResponse (full BFF response for HTTP/frontend)
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.cohort.permissions import (
    COHORT_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_simulation_positions,
    compute_show_simulations,
    compute_simulation_positions_required,
    compute_simulations_required,
    has_access,
)
from app.api.v4.artifacts.cohort.types import (
    CohortDepartment,
    CohortDepartmentSection,
    CohortDescriptionResource,
    CohortDescriptionSection,
    CohortFlagResource,
    CohortFlagSection,
    CohortNameResource,
    CohortNameSection,
    CohortResourceBucket,
    CohortResources,
    CohortSimulation,
    CohortSimulationPosition,
    CohortSimulationPositionSection,
    CohortSimulationSection,
    CohortWebsocketResources,
    CohortWebsocketViews,
    GetCohortApiRequest,
    GetCohortApiResponse,
    GetCohortWebsocketResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.permissions import resolve_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.simulation_positions.get import (
    get_simulation_positions_internal,
)
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.api.v4.resources.simulations.search import search_simulations_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.views.drafts.get import get_draft_cohort_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetCohortAccessSqlParams,
    GetCohortAccessSqlRow,
    GetCohortIdsSqlParams,
    GetCohortIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/cohorts/get_cohort_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/cohorts/get_cohort_ids_complete.sql"


router = APIRouter()


def _dedupe_by_id(items: list[Any], id_attr: str) -> list[Any]:
    """Preserve order while deduplicating by id attribute."""
    seen: set[UUID] = set()
    output: list[Any] = []
    for item in items:
        item_id = getattr(item, id_attr, None)
        if item_id and item_id not in seen:
            seen.add(item_id)
            output.append(item)
    return output


@dataclass
class CohortInternalData:
    """Internal data from core cohort fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_cohort_websocket() - minimal data for WebSocket handlers
    - get_cohort_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    cohort_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Generation mappings
    agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: agent exists)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    simulations_step_show_ai_generate: bool

    # Resources payload
    resources_payload: CohortResources

    # Per-resource group IDs
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents, merged create/link)
    tool_ids_map: dict[str, UUID | None]

    # Raw data for backward-compat fields in API response
    name_id: UUID | None
    description_id: UUID | None
    active_flag_id: UUID | None
    department_ids: list[UUID]
    simulation_ids: list[UUID]

    # Selected resources for API response
    name_resource: CohortNameResource | None
    description_resource: CohortDescriptionResource | None
    flag_resource: CohortFlagResource | None
    department_resources: list[CohortDepartment]
    simulation_resources: list[CohortSimulation]
    simulation_positions: list[CohortSimulationPosition]

    # Config resources (for websocket generation context)
    config_agent_resources: list[Any] | None
    config_model_resources: list[Any] | None
    config_provider_resources: list[Any] | None


async def get_cohort_internal(
    profile_id: UUID,
    cohort_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> CohortInternalData:
    """Core data fetching layer (cacheable).

    Fetches all cohort data using two-pass architecture and returns
    a dataclass with all computed values. This is the shared layer used by:
    - get_cohort_websocket() - minimal data for WebSocket handlers
    - get_cohort_client() - full BFF response for HTTP/frontend

    Args:
        profile_id: The authenticated user's profile ID
        cohort_id: The cohort ID to fetch (None for new cohort mode)
        draft_id: Optional draft ID for draft mode
        bypass_cache: Whether to bypass resource caching

    Returns:
        CohortInternalData with all computed values

    Raises:
        HTTPException: For validation errors (404, 403, 400)
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Resolve shared profile context first (default path)
    async with pool.acquire() as context_conn:
        profile_ctx = await get_auth_profile_internal(
            conn=context_conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

    # Extract user context from internal fetch (single source of truth)
    user_role = profile_ctx.access.role
    actor_name = profile_ctx.access.actor_name
    user_department_ids = [
        d.department_id for d in profile_ctx.departments if d.department_id
    ]

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_cohort_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    # === GROUP ID: Create in Python (moved from SQL side-effect) ===
    if draft_item and draft_item.group_id:
        effective_group_id = draft_item.group_id
    else:
        async with pool.acquire() as c:
            effective_group_id = await c.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
            )

    async with pool.acquire() as conn:
        query1_params = GetCohortAccessSqlParams(
            profile_id=profile_id,
            cohort_id=cohort_id,
            draft_id=draft_id,
            draft_group_id=effective_group_id,
            draft_version=draft_item.version if draft_item is not None else None,
        )

        access_result = cast(
            GetCohortAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )
        cohort_department_ids = access_result.cohort_department_ids or []

        # Early validation: check cohort exists
        if cohort_id is not None:
            if access_result.cohort_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Cohort {cohort_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, cohort_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this cohort. It may be restricted to other departments.",
                )

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetCohortIdsSqlParams(
            profile_id=profile_id,
            cohort_id=cohort_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetCohortIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, create_tool_ids, link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, COHORT_RESOURCES
    )
    # Merge create/link tool IDs into single tool_ids_map
    tool_ids_map: dict[str, UUID | None] = {
        r: create_tool_ids.get(r) or link_tool_ids.get(r) for r in COHORT_RESOURCES
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    show_ai_generate_map = {
        resource: agent_ids.get(resource) is not None for resource in COHORT_RESOURCES
    }

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False)
        for r in ("names", "descriptions", "flags", "departments")
    )
    simulations_step_show_ai_generate = any(
        show_ai_generate_map.get(r, False)
        for r in ("simulations", "simulation_positions")
    )

    # === PYTHON BUSINESS LOGIC ===

    # Compute permissions
    can_edit = compute_can_edit(
        user_role, cohort_department_ids, user_department_ids=user_department_ids
    )
    disabled_reason = compute_disabled_reason(
        user_role, cohort_department_ids, user_department_ids=user_department_ids
    )

    # === PASS 2: Parallel Resource Fetching (each endpoint handles own cache) ===

    # Selected IDs for fetching
    name_ids = [ids_result.name_id] if ids_result.name_id else []
    description_ids = [ids_result.description_id] if ids_result.description_id else []
    flag_ids = [ids_result.active_flag_id] if ids_result.active_flag_id else []
    department_ids = ids_result.department_ids or []
    simulation_ids = ids_result.simulation_ids or []

    # Parallel fetch all resources
    # NOTE: Each query needs its own connection from the pool because
    # asyncpg connections cannot handle concurrent operations.

    async def fetch_names() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_names_internal(c, name_ids, bypass_cache)
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                None,
                name_ids,
                bypass_cache,
                cohort=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_descriptions_internal(c, description_ids, bypass_cache)
            suggestions = await search_descriptions_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                description_ids,
                bypass_cache,
                cohort=True,
            )
            return (selected, suggestions)

    # Cohort-specific flag names (business logic)
    COHORT_FLAG_NAMES = {"cohort_active"}

    async def fetch_flags() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache=bypass_cache,
                cohort=True,
            )
            # Filter to only cohort-specific flags (business logic in Python)
            suggestions = [f for f in all_flags if f.name in COHORT_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            # Use "all" to show all available departments the user has access to
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=department_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_simulations() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_simulations_internal(
                c, simulation_ids, bypass_cache=bypass_cache
            )
            # Search for suggestions
            suggestions = await search_simulations_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                draft_id=effective_group_id,
                suggest_source="recent",
                exclude_ids=simulation_ids,
                bypass_cache=bypass_cache,
                cohort=True,
            )
            return (selected, suggestions)

    async def fetch_simulation_positions() -> list[CohortSimulationPosition]:
        async with pool.acquire() as c:
            return await get_simulation_positions_internal(
                c, simulation_ids, bypass_cache=bypass_cache
            )

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (simulations_selected, simulations_suggestions),
        simulation_positions,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_simulations(),
        fetch_simulation_positions(),
    )

    # Dedupe and combine selected + suggestions
    names_raw = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions_raw = _dedupe_by_id(
        descriptions_selected + descriptions_suggestions, "id"
    )
    flags_raw = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments_raw = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    simulations_raw = _dedupe_by_id(
        simulations_selected + simulations_suggestions, "simulation_id"
    )

    # Convert to response types
    names = [
        CohortNameResource(id=n.id, name=n.name, generated=n.generated)
        for n in names_raw
    ]
    descriptions = [
        CohortDescriptionResource(
            id=d.id, description=d.description, generated=d.generated
        )
        for d in descriptions_raw
    ]
    departments = [
        CohortDepartment(
            department_id=d.department_id,
            name=d.name,
            description=d.description,
            generated=d.generated,
        )
        for d in departments_raw
    ]
    simulations = [
        CohortSimulation(
            simulation_id=s.simulation_id,
            name=s.name,
            description=s.description,
            time_limit=s.time_limit,
            generated=s.generated,
        )
        for s in simulations_raw
    ]

    # Convert flags to CohortFlagResource format
    flags = [
        CohortFlagResource(
            id=f.id,
            name=f.name,
            description=f.description,
            icon=f.icon,
            generated=f.generated,
        )
        for f in flags_raw
        if f.id
    ]

    # Find selected resources
    name_resource = next((n for n in names if n.id == ids_result.name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == ids_result.description_id),
        None,
    )
    flag_resource = next((f for f in flags if f.id == ids_result.active_flag_id), None)

    # Selected multi-select resources
    department_resources = [d for d in departments if d.department_id in department_ids]
    simulation_resources = [s for s in simulations if s.simulation_id in simulation_ids]

    # Suggestion IDs
    name_suggestions_ids = [n.id for n in names_suggestions]
    description_suggestions_ids = [d.id for d in descriptions_suggestions]
    department_suggestions_ids = [d.department_id for d in departments_suggestions]
    simulation_suggestions_ids = [s.simulation_id for s in simulations_suggestions]

    # Compute final show flags based on actual data
    show_name = compute_show_name()
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_simulations_flag = compute_show_simulations(len(simulations))
    show_simulation_positions_flag = compute_show_simulation_positions(
        len(simulation_positions or [])
    )

    # Validation for new mode
    if cohort_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Build show/required flags maps
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "simulations": show_simulations_flag,
        "simulation_positions": show_simulation_positions_flag,
    }
    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(show_departments_flag),
        "simulations": compute_simulations_required(),
        "simulation_positions": compute_simulation_positions_required(),
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions_ids,
        "descriptions": description_suggestions_ids,
        "departments": department_suggestions_ids,
        "simulations": simulation_suggestions_ids,
    }

    # Build resources payload
    resources_payload = CohortResources(
        resources=CohortResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=flags,
            departments=departments,
            simulations=simulations,
            simulation_positions=simulation_positions or [],
        ),
        current=CohortResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=[flag_resource] if flag_resource else [],
            departments=department_resources or [],
            simulations=simulation_resources or [],
            simulation_positions=simulation_positions or [],
        ),
    )

    # Per-resource group IDs (cohort uses single group_id for all resources)
    resource_group_ids: dict[str, UUID | None] = {
        "names": effective_group_id,
        "descriptions": effective_group_id,
        "flags": effective_group_id,
        "departments": effective_group_id,
        "simulations": effective_group_id,
        "simulation_positions": effective_group_id,
    }

    selected_agent_ids = [aid for aid in agent_ids.values() if aid]
    unique_agent_ids = list(dict.fromkeys(selected_agent_ids))
    config_agents_result: list[Any] = []
    config_models_result: list[Any] = []
    config_providers_result: list[Any] = []
    if unique_agent_ids:
        async with pool.acquire() as c:
            config_agents_result = await get_agents_internal(
                c, unique_agent_ids, bypass_cache
            )
        if config_agents_result:
            model_ids = list(
                {
                    m
                    for agent in config_agents_result
                    for m in [getattr(agent, "model_id", None)]
                    if m is not None
                }
            )
            provider_ids = list(
                {
                    p
                    for agent in config_agents_result
                    for p in [getattr(agent, "provider_id", None)]
                    if p is not None
                }
            )
            if model_ids:
                async with pool.acquire() as c:
                    config_models_result = await get_models_internal(
                        c, model_ids, bypass_cache
                    )
            if provider_ids:
                async with pool.acquire() as c:
                    config_providers_result = await get_providers_internal(
                        c, provider_ids, bypass_cache
                    )

    return CohortInternalData(
        # Access/context
        actor_name=actor_name,
        cohort_exists=access_result.cohort_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=access_result.effective_draft_version,
        group_id=effective_group_id,
        # Generation mapping
        agent_ids=agent_ids,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        simulations_step_show_ai_generate=simulations_step_show_ai_generate,
        # Resources
        resources_payload=resources_payload,
        # Per-resource group IDs
        resource_group_ids=resource_group_ids,
        # Per-resource tool IDs
        tool_ids_map=tool_ids_map,
        # Raw IDs
        name_id=ids_result.name_id,
        description_id=ids_result.description_id,
        active_flag_id=ids_result.active_flag_id,
        department_ids=department_ids,
        simulation_ids=simulation_ids,
        # Selected resources
        name_resource=name_resource,
        description_resource=description_resource,
        flag_resource=flag_resource,
        department_resources=department_resources,
        simulation_resources=simulation_resources,
        simulation_positions=simulation_positions or [],
        config_agent_resources=config_agents_result or None,
        config_model_resources=config_models_result or None,
        config_provider_resources=config_providers_result or None,
    )


async def get_cohort_websocket(
    profile_id: UUID,
    cohort_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetCohortWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns generation context for socket handlers:
    - group_id
    - resource_agent_ids mapping (resource_type -> agent_id)
    - selected resources + config resources for Jinja context
    """
    data = await get_cohort_internal(
        profile_id=profile_id,
        cohort_id=cohort_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    draft_view = None
    if draft_id is not None:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")
        async with pool.acquire() as conn:
            draft_items = await get_draft_cohort_internal(
                conn=conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            draft_view = draft_items[0] if draft_items else None

    current = data.resources_payload.current

    tools_result: list[Any] = []
    if data.config_agent_resources:
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            ids = getattr(agent, "tool_ids", None) or []
            tool_ids.extend(ids)
        deduped_tool_ids = list(dict.fromkeys(tool_ids))
        if deduped_tool_ids:
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")
            async with pool.acquire() as conn:
                tools_result = await get_tools_internal(
                    conn, deduped_tool_ids, bypass_cache
                )

    return GetCohortWebsocketResponse(
        group_id=data.group_id,
        views=CohortWebsocketViews(draft_cohort=draft_view) if draft_view else None,
        resource_agent_ids=data.agent_ids,
        resources=CohortWebsocketResources(
            names=current.names if current else None,
            descriptions=current.descriptions if current else None,
            flags=current.flags if current else None,
            departments=current.departments if current else None,
            simulations=current.simulations if current else None,
            simulation_positions=current.simulation_positions if current else None,
            agents=data.config_agent_resources,
            models=data.config_model_resources,
            providers=data.config_provider_resources,
            tools=tools_result or None,
        ),
    )


async def get_cohort_client(
    profile_id: UUID,
    cohort_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetCohortApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI sections and
    computed *_show_ai_generate flags.
    """
    data = await get_cohort_internal(
        profile_id=profile_id,
        cohort_id=cohort_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    resources_bucket = data.resources_payload.resources
    current_bucket = data.resources_payload.current

    def section_common(resource_key: str) -> dict[str, Any]:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key, []),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "tool_id": data.tool_ids_map.get(resource_key),
        }

    return GetCohortApiResponse(
        # Context
        actor_name=data.actor_name,
        cohort_exists=data.cohort_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        simulations_step_show_ai_generate=data.simulations_step_show_ai_generate,
        names=CohortNameSection(
            resource=(
                current_bucket.names[0]
                if current_bucket and current_bucket.names
                else None
            ),
            resources=(resources_bucket.names if resources_bucket else None),
            **section_common("names"),
        ),
        descriptions=CohortDescriptionSection(
            resource=(
                current_bucket.descriptions[0]
                if current_bucket and current_bucket.descriptions
                else None
            ),
            resources=(resources_bucket.descriptions if resources_bucket else None),
            **section_common("descriptions"),
        ),
        flags=CohortFlagSection(
            resource=(
                current_bucket.flags[0]
                if current_bucket and current_bucket.flags
                else None
            ),
            resources=(resources_bucket.flags if resources_bucket else None),
            **section_common("flags"),
        ),
        departments=CohortDepartmentSection(
            current=(current_bucket.departments if current_bucket else None),
            resources=(resources_bucket.departments if resources_bucket else None),
            **section_common("departments"),
        ),
        simulations=CohortSimulationSection(
            current=(current_bucket.simulations if current_bucket else None),
            resources=(resources_bucket.simulations if resources_bucket else None),
            **section_common("simulations"),
        ),
        simulation_positions=CohortSimulationPositionSection(
            current=(current_bucket.simulation_positions if current_bucket else None),
            resources=(
                resources_bucket.simulation_positions if resources_bucket else None
            ),
            **section_common("simulation_positions"),
        ),
    )


@router.post(
    "/get",
    response_model=GetCohortApiResponse,
    dependencies=[
        audit_activity(
            "cohort.get",
            "{{ actor.name }} {% if cohort %}viewed{% else %}opened new{% endif %} cohort{% if cohort %} '{{ cohort.name }}'{% endif %}",
        )
    ],
)
async def get_cohort(
    request: GetCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortApiResponse:
    """Get cohort information using two-pass architecture.

    This is a thin HTTP wrapper around get_cohort_client().

    Query 1: Access check (user role, departments, cohort state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Call the client function (calls internal itself)
        response_data = await get_cohort_client(
            profile_id=profile_id,
            cohort_id=request.cohort_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            if (
                request.cohort_id
                and response_data.names
                and response_data.names.resource
            ):
                audit_ctx["cohort"] = {
                    "name": response_data.names.resource.name,
                    "id": str(request.cohort_id),
                }
            audit_set(http_request, **audit_ctx)

        # No global cache for this response - individual resources are cached
        response.headers["X-Cache-Tags"] = "cohorts"
        response.headers["X-Cache-Hit"] = "0"
        response.headers["X-Two-Pass"] = "1"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_cohort",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

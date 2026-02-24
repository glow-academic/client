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
    compute_profile_personas_required,
    compute_profiles_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_profile_personas,
    compute_show_profiles,
    compute_show_simulation_availability,
    compute_show_simulation_positions,
    compute_show_simulations,
    compute_simulation_availability_required,
    compute_simulation_positions_required,
    compute_simulations_required,
    has_access,
)
from app.api.v4.artifacts.cohort.types import (
    CohortDepartment,
    CohortDepartmentSection,
    CohortDescriptionResource,
    CohortDescriptionSection,
    CohortFlagConfig,
    CohortFlagSection,
    CohortNameResource,
    CohortNameSection,
    CohortProfile,
    CohortProfilePersona,
    CohortProfilePersonaSection,
    CohortProfileSection,
    CohortResourceBucket,
    CohortResources,
    CohortSimulation,
    CohortSimulationAvailability,
    CohortSimulationAvailabilitySection,
    CohortSimulationPosition,
    CohortSimulationPositionSection,
    CohortSimulationSection,
    CohortWebsocketEntries,
    CohortWebsocketResources,
    GetCohortApiRequest,
    GetCohortApiResponse,
    GetCohortWebsocketResponse,
)
from app.api.v4.artifacts.types import WebsocketConfig
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.entries.cohort_drafts.get import get_cohort_drafts_entries_internal
from app.api.v4.entries.runs.search import get_run_list_entries_internal
from app.api.v4.permissions import resolve_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.args.get import get_args_internal
from app.api.v4.resources.args_outputs.get import get_args_outputs_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.personas.search import search_personas_internal
from app.api.v4.resources.profile_personas.get import get_profile_personas_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.profiles.search import search_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.simulation_availability.get import (
    get_simulation_availability_internal,
)
from app.api.v4.resources.simulation_positions.get import (
    get_simulation_positions_internal,
)
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.api.v4.resources.simulations.search import search_simulations_internal
from app.api.v4.resources.tools.get import get_tools_internal
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

    # Profiles step
    profiles_step_show_ai_generate: bool

    # Selected resources for API response
    name_resource: CohortNameResource | None
    description_resource: CohortDescriptionResource | None
    flag_resource: CohortFlagConfig | None
    department_resources: list[CohortDepartment]
    simulation_resources: list[CohortSimulation]
    simulation_positions: list[CohortSimulationPosition]
    simulation_availability: list[CohortSimulationAvailability]
    profile_resources: list[CohortProfile]
    profile_persona_resources: list[CohortProfilePersona]

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
            draft_items = await get_cohort_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
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
        for r in ("simulations", "simulation_positions", "simulation_availability")
    )
    profiles_step_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in ("profiles", "profile_personas")
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
    profile_ids = ids_result.profile_ids or []
    profile_persona_ids = ids_result.profile_persona_ids or []

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
                "all",
                description_ids,
                bypass_cache,
                cohort=True,
            )
            return (selected, suggestions)

    # Cohort-specific flag types (business logic)
    COHORT_FLAG_TYPES = {"cohort_active"}

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
            suggestions = [f for f in all_flags if f.type in COHORT_FLAG_TYPES]
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
                suggest_source="all",
                exclude_ids=simulation_ids,
                bypass_cache=bypass_cache,
                cohort=True,
            )
            return (selected, suggestions)

    async def fetch_simulation_positions() -> list[CohortSimulationPosition]:
        async with pool.acquire() as c:
            items = await get_simulation_positions_internal(
                c, simulation_ids, bypass_cache=bypass_cache
            )
            return [
                CohortSimulationPosition(
                    simulation_id=item.simulation_id,
                    value=item.value,
                    generated=item.generated,
                    mcp=item.mcp,
                )
                for item in items
            ]

    simulation_availability_ids = ids_result.simulation_availability_ids or []

    async def fetch_simulation_availability() -> list[CohortSimulationAvailability]:
        if not simulation_availability_ids:
            return []
        async with pool.acquire() as c:
            items = await get_simulation_availability_internal(
                c, simulation_availability_ids, bypass_cache=bypass_cache
            )
            return [
                CohortSimulationAvailability(
                    id=item.id,
                    simulation_id=item.simulation_id,
                    time=item.time,
                    type=item.type,
                    generated=item.generated,
                    mcp=item.mcp,
                )
                for item in items
            ]

    async def fetch_profiles() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = (
                await get_profiles_internal(c, profile_ids, bypass_cache=bypass_cache)
                if profile_ids
                else []
            )
            suggestions = await search_profiles_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                exclude_ids=profile_ids or [],
                department_ids=user_department_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_profile_personas() -> list[CohortProfilePersona]:
        if not profile_persona_ids:
            return []
        async with pool.acquire() as c:
            items = await get_profile_personas_internal(
                c, profile_persona_ids, bypass_cache=bypass_cache
            )
            return [
                CohortProfilePersona(
                    id=item.id,
                    profile_id=item.profile_id,
                    persona_id=item.persona_id,
                    generated=item.generated,
                )
                for item in items
            ]

    async def fetch_personas() -> list[Any]:
        async with pool.acquire() as c:
            return await search_personas_internal(
                c,
                search=None,
                limit_count=100,
                offset_count=0,
                bypass_cache=bypass_cache,
            )

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (simulations_selected, simulations_suggestions),
        simulation_positions,
        simulation_availability,
        (profiles_selected, profiles_suggestions),
        profile_personas_fetched,
        personas_fetched,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_simulations(),
        fetch_simulation_positions(),
        fetch_simulation_availability(),
        fetch_profiles(),
        fetch_profile_personas(),
        fetch_personas(),
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
    profiles_raw = _dedupe_by_id(profiles_selected + profiles_suggestions, "profile_id")

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
            generated=s.generated,
        )
        for s in simulations_raw
    ]
    profiles = [
        CohortProfile(
            profile_id=p.profile_id,
            name=p.name,
            description=p.description,
        )
        for p in profiles_raw
    ]

    # Convert flags to CohortFlagConfig format (matches client FlagConfig)
    # show/required are set at the section level via section_common(), not per-flag
    flags = [
        CohortFlagConfig(
            key=f.name,
            label=f.name,
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
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
    flag_resource = next(
        (f for f in flags if f.flag_option_id == ids_result.active_flag_id), None
    )

    # Selected multi-select resources
    department_resources = [d for d in departments if d.department_id in department_ids]
    simulation_resources = [s for s in simulations if s.simulation_id in simulation_ids]
    profile_resources = [
        p for p in profiles if p.profile_id and p.profile_id in profile_ids
    ]

    # Suggestion IDs
    name_suggestions_ids = [n.id for n in names_suggestions]
    description_suggestions_ids = [d.id for d in descriptions_suggestions]
    department_suggestions_ids = [d.department_id for d in departments_suggestions]
    simulation_suggestions_ids = [s.simulation_id for s in simulations_suggestions]
    profile_suggestions_ids = [
        p.profile_id for p in profiles_suggestions if p.profile_id
    ]

    # Compute final show flags based on actual data
    show_name = compute_show_name()
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_simulations_flag = compute_show_simulations(len(simulations))
    show_simulation_positions_flag = compute_show_simulation_positions(
        len(simulation_positions or [])
    )
    show_simulation_availability_flag = compute_show_simulation_availability(
        len(simulation_availability or [])
    )
    show_profiles_flag = compute_show_profiles(len(profiles))
    show_profile_personas_flag = compute_show_profile_personas(
        len(profile_personas_fetched or [])
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
        "simulation_availability": show_simulation_availability_flag,
        "profiles": show_profiles_flag,
        "profile_personas": show_profile_personas_flag,
    }
    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(show_departments_flag),
        "simulations": compute_simulations_required(),
        "simulation_positions": compute_simulation_positions_required(),
        "simulation_availability": compute_simulation_availability_required(),
        "profiles": compute_profiles_required(),
        "profile_personas": compute_profile_personas_required(),
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions_ids,
        "descriptions": description_suggestions_ids,
        "departments": department_suggestions_ids,
        "simulations": simulation_suggestions_ids,
        "profiles": profile_suggestions_ids,
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
            simulation_availability=simulation_availability or [],
            profiles=profiles,
            profile_personas=profile_personas_fetched or [],
            personas=personas_fetched or [],
        ),
        current=CohortResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=[flag_resource] if flag_resource else [],
            departments=department_resources or [],
            simulations=simulation_resources or [],
            simulation_positions=simulation_positions or [],
            simulation_availability=simulation_availability or [],
            profiles=profile_resources,
            profile_personas=profile_personas_fetched or [],
            personas=personas_fetched or [],
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
        "simulation_availability": effective_group_id,
        "profiles": effective_group_id,
        "profile_personas": effective_group_id,
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
            if model_ids:
                async with pool.acquire() as c:
                    config_models_result = await get_models_internal(
                        c, model_ids, bypass_cache
                    )
            provider_ids = list(
                dict.fromkeys(
                    m.provider_id
                    for m in config_models_result
                    if getattr(m, "provider_id", None) is not None
                )
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
        profiles_step_show_ai_generate=profiles_step_show_ai_generate,
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
        simulation_availability=simulation_availability or [],
        profile_resources=profile_resources,
        profile_persona_resources=profile_personas_fetched or [],
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

    # Fetch draft, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_cohort_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            return draft_items[0] if draft_items else None

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn, [profile_id], bypass_cache)

    async def fetch_runs_today():
        if not pool:
            return None
        from datetime import UTC, datetime

        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as conn:
            return await get_run_list_entries_internal(
                conn=conn,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    async def fetch_tools():
        if not data.config_agent_resources or not pool:
            return []
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            ids = getattr(agent, "tool_ids", None) or []
            tool_ids.extend(ids)
        deduped_tool_ids = list(dict.fromkeys(tool_ids))
        if not deduped_tool_ids:
            return []
        async with pool.acquire() as conn:
            return await get_tools_internal(conn, deduped_tool_ids, bypass_cache)

    (
        draft_view,
        config_profile_result,
        runs_result,
        tools_result,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    all_resources = data.resources_payload.resources

    # Enrich tools with args and args_outputs
    config_tools = tools_result or []
    config_args = None
    config_args_outputs = None
    if config_tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)
        if all_args_ids or all_args_output_ids:

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_internal(
                        c, list(set(all_args_ids)), bypass_cache=bypass_cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs_internal(
                        c, list(set(all_args_output_ids)), bypass_cache=bypass_cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    # Build entries (always construct — both fields optional now)
    entries = CohortWebsocketEntries(
        draft_cohort=draft_view,
        runs=runs_result,
    )

    websocket_config = WebsocketConfig(
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
    )

    return GetCohortWebsocketResponse(
        group_id=data.group_id,
        entries=entries if draft_view or runs_result else None,
        resource_agent_ids=data.agent_ids,
        resources=CohortWebsocketResources(
            names=all_resources.names if all_resources else None,
            descriptions=all_resources.descriptions if all_resources else None,
            flags=all_resources.flags if all_resources else None,
            departments=all_resources.departments if all_resources else None,
            simulations=all_resources.simulations if all_resources else None,
            simulation_positions=all_resources.simulation_positions
            if all_resources
            else None,
            simulation_availability=all_resources.simulation_availability
            if all_resources
            else None,
            profiles=all_resources.profiles if all_resources else None,
            profile_personas=all_resources.profile_personas if all_resources else None,
            personas=all_resources.personas if all_resources else None,
        ),
        config=websocket_config,
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
        profiles_step_show_ai_generate=data.profiles_step_show_ai_generate,
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
        simulation_availability=CohortSimulationAvailabilitySection(
            current=(
                current_bucket.simulation_availability if current_bucket else None
            ),
            resources=(
                resources_bucket.simulation_availability if resources_bucket else None
            ),
            **section_common("simulation_availability"),
        ),
        profiles=CohortProfileSection(
            current=(current_bucket.profiles if current_bucket else None),
            resources=(resources_bucket.profiles if resources_bucket else None),
            **section_common("profiles"),
        ),
        profile_personas=CohortProfilePersonaSection(
            current=(current_bucket.profile_personas if current_bucket else None),
            resources=(resources_bucket.profile_personas if resources_bucket else None),
            **section_common("profile_personas"),
        ),
        personas=(resources_bucket.personas if resources_bucket else None),
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

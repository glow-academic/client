"""Simulation get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_simulation_internal() - Core data fetching (cacheable, returns dataclass)
2. get_simulation_websocket() - Minimal data for WebSocket handlers
3. get_simulation_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.simulation.permissions import (
    SIMULATION_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_scenario_flags_required,
    compute_scenario_positions_required,
    compute_scenario_rubrics_required,
    compute_scenario_show_flags,
    compute_scenario_time_limits_required,
    compute_scenarios_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_scenario_flags,
    compute_show_scenario_positions,
    compute_show_scenario_rubrics,
    compute_show_scenario_time_limits,
    compute_show_scenarios,
    has_access,
)
from app.api.v4.artifacts.simulation.types import (
    GetSimulationAccessSqlParams,
    GetSimulationAccessSqlRow,
    GetSimulationApiRequest,
    GetSimulationApiResponse,
    GetSimulationIdsSqlParams,
    GetSimulationIdsSqlRow,
    GetSimulationWebsocketResponse,
    SimulationDepartment,
    SimulationDepartmentSection,
    SimulationDescriptionSection,
    SimulationFlagConfig,
    SimulationFlagSection,
    SimulationNameSection,
    SimulationResourceBucket,
    SimulationResources,
    SimulationScenario,
    SimulationScenarioFlagSection,
    SimulationScenarioPositionSection,
    SimulationScenarioRubricSection,
    SimulationScenarioSection,
    SimulationScenarioTimeLimitSection,
    SimulationWebsocketEntries,
    SimulationWebsocketResources,
)
from app.api.v4.artifacts.types import WebsocketConfig
from app.api.v4.entries.runs.search import get_run_list_entries_internal
from app.api.v4.entries.simulation_drafts.get import (
    get_simulation_drafts_entries_internal,
)
from app.api.v4.permissions import has_tools_for_resource, resolve_agents_for_artifact
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
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.rubrics.get import get_rubrics_internal
from app.api.v4.resources.scenario_flags.get import get_scenario_flags_internal
from app.api.v4.resources.scenario_flags.search import search_scenario_flags_internal
from app.api.v4.resources.scenario_positions.get import get_scenario_positions_internal
from app.api.v4.resources.scenario_positions.search import (
    search_scenario_positions_internal,
)
from app.api.v4.resources.scenario_rubrics.get import get_scenario_rubrics_internal
from app.api.v4.resources.scenario_rubrics.search import (
    search_scenario_rubrics_internal,
)
from app.api.v4.resources.scenario_time_limits.get import (
    get_scenario_time_limits_internal,
)
from app.api.v4.resources.scenario_time_limits.search import (
    search_scenario_time_limits_internal,
)
from app.api.v4.resources.scenarios.search import search_scenarios_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.sql_helper import execute_sql_typed

# SQL paths for two-pass architecture
QUERY1_SQL_PATH = "app/sql/v4/queries/simulations/get_simulation_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/simulations/get_simulation_ids_complete.sql"

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
class SimulationInternalData:
    """Internal data from core simulation fetching (cacheable layer)."""

    # Access/context
    actor_name: str | None
    simulation_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: agent exists for resource)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool

    # Resources payload
    resources_payload: SimulationResources

    # Per-resource tool IDs (from selected agents, merged create/link)
    tool_ids_map: dict[str, UUID | None]

    # Config resources for websocket generation
    config_agent_resources: list[Any] | None
    config_model_resources: list[Any] | None
    config_provider_resources: list[Any] | None


async def get_simulation_internal(
    profile_id: UUID,
    simulation_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    scenario_search: str | None = None,
    filter_scenario_ids: list[UUID] | None = None,
) -> SimulationInternalData:
    """Core data fetching layer (cacheable).

    Fetches all simulation data using two-pass architecture and returns
    a dataclass with all computed values.
    """
    # Lazy imports to avoid circular deps (simulation/__init__.py → auth → resources → simulation)
    from app.api.v4.auth.profile import get_auth_profile_internal
    from app.api.v4.auth.settings import get_auth_settings_internal

    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Fetch draft if draft_id provided
    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_simulation_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    # Fetch user context for permissions
    async with pool.acquire() as context_conn:
        profile_ctx = await get_auth_profile_internal(
            conn=context_conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )
    user_role = profile_ctx.access.role
    actor_name = profile_ctx.access.actor_name
    user_department_ids = [
        d.department_id for d in profile_ctx.departments if d.department_id
    ]

    # === GROUP ID: Create in Python (moved from SQL side-effect) ===
    if draft_item and draft_item.group_id:
        effective_group_id = draft_item.group_id
    else:
        async with pool.acquire() as c:
            effective_group_id = await c.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id"
            )

    async with pool.acquire() as conn:
        # === QUERY 1: Access Check ===
        query1_params = GetSimulationAccessSqlParams(
            profile_id=profile_id,
            simulation_id=simulation_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetSimulationAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        simulation_department_ids = access_result.simulation_department_ids or []
        cohort_usage_count = access_result.cohort_usage_count or 0

        if simulation_id is not None:
            if access_result.simulation_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Simulation {simulation_id} not found",
                )
            if not has_access(
                user_role, user_department_ids, simulation_department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this simulation. It may be restricted to other departments.",
                )

        effective_draft_version = access_result.effective_draft_version

        # === QUERY 2: ID Fetching ===
        query2_params = GetSimulationIdsSqlParams(
            profile_id=profile_id,
            simulation_id=simulation_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetSimulationIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, create_tool_ids, link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, SIMULATION_RESOURCES
    )
    # Merge create/link tool IDs into single tool_ids_map
    tool_ids_map: dict[str, UUID | None] = {
        r: create_tool_ids.get(r) or link_tool_ids.get(r) for r in SIMULATION_RESOURCES
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    show_ai_generate_map = {
        resource: agent_ids.get(resource) is not None
        for resource in SIMULATION_RESOURCES
    }

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False)
        for r in ("names", "descriptions", "flags", "departments", "scenarios")
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        simulation_department_ids=simulation_department_ids,
        cohort_usage_count=cohort_usage_count,
        user_department_ids=user_department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        simulation_department_ids=simulation_department_ids,
        cohort_usage_count=cohort_usage_count,
        user_department_ids=user_department_ids,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [ids_result.name_id] if ids_result.name_id else []
    description_ids = [ids_result.description_id] if ids_result.description_id else []
    flag_ids = ids_result.flag_ids or []
    department_ids = ids_result.department_ids or []
    scenario_ids = ids_result.scenario_ids or []
    effective_scenario_ids = filter_scenario_ids or scenario_ids
    scenario_flag_ids = ids_result.scenario_flag_ids or []
    scenario_position_ids = ids_result.scenario_position_ids or []
    scenario_rubric_ids = ids_result.scenario_rubric_ids or []
    scenario_time_limit_ids = ids_result.scenario_time_limit_ids or []

    async def fetch_names():
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
                simulation=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions():
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
                simulation=True,
            )
            return (selected, suggestions)

    SIMULATION_FLAG_TYPES_ORDERED = ["simulation_active", "practice"]

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                search=None,
                limit_count=50,
                offset_count=0,
                exclude_ids=None,
                bypass_cache=bypass_cache,
                simulation=True,
            )
            flags_by_type = {f.type: f for f in all_flags}
            available = [
                flags_by_type[t]
                for t in SIMULATION_FLAG_TYPES_ORDERED
                if t in flags_by_type
            ]
            return (selected, available)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            dept_source = "all" if simulation_id is None else "recent"
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source=dept_source,
                exclude_ids=department_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_scenarios():
        from app.api.v4.resources.scenarios.get import get_scenarios_internal

        async with pool.acquire() as c:
            selected = await get_scenarios_internal(c, scenario_ids, bypass_cache)
            suggestions = await search_scenarios_internal(
                c,
                search=scenario_search,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="recent",
                exclude_ids=scenario_ids,
                bypass_cache=bypass_cache,
                simulation=True,
            )
            return (selected, suggestions)

    async def fetch_scenario_flags():
        async with pool.acquire() as c:
            selected = await get_scenario_flags_internal(
                c, scenario_flag_ids, bypass_cache
            )
            suggestions = await search_scenario_flags_internal(
                c,
                scenario_ids=effective_scenario_ids,
                bypass_cache=bypass_cache,
                simulation=True,
            )
            return (selected, suggestions)

    async def fetch_scenario_positions():
        async with pool.acquire() as c:
            selected = await get_scenario_positions_internal(
                c, scenario_position_ids, bypass_cache
            )
            suggestions = await search_scenario_positions_internal(
                c, effective_scenario_ids, bypass_cache=bypass_cache
            )
            return (selected, suggestions)

    async def fetch_scenario_rubrics():
        async with pool.acquire() as c:
            selected = await get_scenario_rubrics_internal(
                c, scenario_rubric_ids, bypass_cache
            )
            suggestions = await search_scenario_rubrics_internal(
                c, effective_scenario_ids, bypass_cache=bypass_cache
            )
            return (selected, suggestions)

    async def fetch_scenario_time_limits():
        async with pool.acquire() as c:
            selected = await get_scenario_time_limits_internal(
                c, scenario_time_limit_ids, bypass_cache
            )
            suggestions = await search_scenario_time_limits_internal(
                c, effective_scenario_ids, bypass_cache=bypass_cache
            )
            return (selected, suggestions)

    async def fetch_rubrics():
        async with pool.acquire() as c:
            return await get_rubrics_internal(c, None, bypass_cache)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_available),
        (departments_selected, departments_suggestions),
        (scenarios_selected, scenarios_suggestions),
        (scenario_flags_selected, scenario_flags_suggestions),
        (scenario_positions_selected, scenario_positions_suggestions),
        (scenario_rubrics_selected, scenario_rubrics_suggestions),
        (scenario_time_limits_selected, scenario_time_limits_suggestions),
        rubrics,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_scenarios(),
        fetch_scenario_flags(),
        fetch_scenario_positions(),
        fetch_scenario_rubrics(),
        fetch_scenario_time_limits(),
        fetch_rubrics(),
    )

    # Combine and dedupe
    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    scenarios_combined = _dedupe_by_id(
        scenarios_selected + scenarios_suggestions, "scenario_id"
    )
    scenario_flags = _dedupe_by_id(
        list(scenario_flags_selected) + list(scenario_flags_suggestions), "id"
    )
    scenario_positions = _dedupe_by_id(
        list(scenario_positions_selected) + list(scenario_positions_suggestions),
        "id",
    )
    scenario_rubrics = _dedupe_by_id(
        list(scenario_rubrics_selected) + list(scenario_rubrics_suggestions), "id"
    )
    scenario_time_limits = _dedupe_by_id(
        list(scenario_time_limits_selected) + list(scenario_time_limits_suggestions),
        "id",
    )

    # Find selected resources
    name_resource = next((n for n in names if n.id == ids_result.name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == ids_result.description_id), None
    )
    department_resources = [d for d in departments if d.department_id in department_ids]

    # Convert scenarios to SimulationScenario type with computed show_* flags
    def convert_scenario(s: Any) -> SimulationScenario:
        return SimulationScenario(
            scenario_id=s.scenario_id,
            name=s.name,
            description=s.description,
            generated=s.generated,
            **compute_scenario_show_flags(
                problem_statement_enabled=s.problem_statement_enabled,
                objectives_enabled=s.objectives_enabled,
                video_enabled=s.video_enabled,
                images_enabled=s.images_enabled,
                questions_enabled=s.questions_enabled,
            ),
        )

    scenario_resources_current = [convert_scenario(s) for s in scenarios_selected]
    scenarios_typed = [convert_scenario(s) for s in scenarios_combined]

    # Build flag configs (canonical pattern: direct field mapping from flags_resource)
    show_flag = compute_show_flag()
    simulation_flags = [
        SimulationFlagConfig(
            key=flag.name,
            label=flag.name,
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            generated=flag.generated,
        )
        for flag in flags_available
        if flag.id
    ]
    flag_ids_set = set(flag_ids)
    flag_resources = [f for f in simulation_flags if f.flag_option_id in flag_ids_set]

    # Suggestion IDs
    name_suggestions_ids = [n.id for n in names_suggestions]
    description_suggestions_ids = [d.id for d in descriptions_suggestions]
    department_suggestions_ids = [d.department_id for d in departments_suggestions]
    scenario_suggestions_ids = [s.scenario_id for s in scenarios_suggestions]

    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions_ids,
        "descriptions": description_suggestions_ids,
        "departments": department_suggestions_ids,
        "scenarios": scenario_suggestions_ids,
    }

    # Convert departments to typed format
    departments_typed = [
        SimulationDepartment(
            department_id=d.department_id,
            name=d.name,
            description=d.description,
            generated=d.generated,
        )
        for d in departments
    ]
    department_resources_typed = [
        SimulationDepartment(
            department_id=d.department_id,
            name=d.name,
            description=d.description,
            generated=d.generated,
        )
        for d in department_resources
    ]

    # Compute show/required flags
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_departments_flag = compute_show_departments(len(departments))
    show_scenarios_flag = compute_show_scenarios(len(scenarios_combined))

    show_scenario_flags_flag = compute_show_scenario_flags(
        effective_scenario_ids, len(scenario_flags), len(scenarios_combined)
    )
    show_scenario_positions_flag = compute_show_scenario_positions(
        effective_scenario_ids, len(scenario_positions), len(scenarios_combined)
    )
    show_scenario_rubrics_flag = compute_show_scenario_rubrics(
        effective_scenario_ids, len(scenario_rubrics), len(scenarios_combined)
    )
    show_scenario_time_limits_flag = compute_show_scenario_time_limits(
        effective_scenario_ids, len(scenario_time_limits), len(scenarios_combined)
    )

    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "scenarios": show_scenarios_flag,
        "scenario_flags": show_scenario_flags_flag,
        "scenario_positions": show_scenario_positions_flag,
        "scenario_rubrics": show_scenario_rubrics_flag,
        "scenario_time_limits": show_scenario_time_limits_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "scenarios": compute_scenarios_required(),
        "scenario_flags": compute_scenario_flags_required(),
        "scenario_positions": compute_scenario_positions_required(),
        "scenario_rubrics": compute_scenario_rubrics_required(),
        "scenario_time_limits": compute_scenario_time_limits_required(),
    }

    # Validation for new mode
    if simulation_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Build resources payload (persona-style)
    resources_payload = SimulationResources(
        resources=SimulationResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=simulation_flags,
            departments=departments_typed,
            scenarios=scenarios_typed,
            scenario_flags=scenario_flags,
            scenario_positions=scenario_positions,
            scenario_rubrics=scenario_rubrics,
            scenario_time_limits=scenario_time_limits,
            rubrics=rubrics,
        ),
        current=SimulationResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=flag_resources or [],
            departments=department_resources_typed or [],
            scenarios=scenario_resources_current or [],
            scenario_flags=list(scenario_flags_selected) or [],
            scenario_positions=list(scenario_positions_selected) or [],
            scenario_rubrics=list(scenario_rubrics_selected) or [],
            scenario_time_limits=list(scenario_time_limits_selected) or [],
        ),
    )

    # Fetch config resources for websocket generation context
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
    model_ids = list(
        dict.fromkeys(
            [
                getattr(agent, "model_id", None)
                for agent in config_agents_result
                if getattr(agent, "model_id", None) is not None
            ]
        )
    )
    if model_ids:
        async with pool.acquire() as c:
            config_models_result = await get_models_internal(c, model_ids, bypass_cache)
    provider_ids = list(
        dict.fromkeys(
            [
                getattr(model, "provider_id", None)
                for model in config_models_result
                if getattr(model, "provider_id", None) is not None
            ]
        )
    )
    if provider_ids:
        async with pool.acquire() as c:
            config_providers_result = await get_providers_internal(
                c, provider_ids, bypass_cache
            )

    return SimulationInternalData(
        actor_name=actor_name,
        simulation_exists=access_result.simulation_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        agent_ids=agent_ids,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        resources_payload=resources_payload,
        tool_ids_map=tool_ids_map,
        config_agent_resources=config_agents_result or None,
        config_model_resources=config_models_result or None,
        config_provider_resources=config_providers_result or None,
    )


async def get_simulation_websocket(
    profile_id: UUID,
    simulation_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetSimulationWebsocketResponse:
    """Minimal response for simulation websocket handlers."""
    data = await get_simulation_internal(
        profile_id=profile_id,
        simulation_id=simulation_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # Fetch draft, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_simulation_drafts_entries_internal(
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

    current = data.resources_payload.current
    selected_flag_ids = {
        getattr(f, "flag_option_id", None) or getattr(f, "id", None)
        for f in (current.flags if current and current.flags else [])
    } - {None}
    all_enriched_flags = (
        data.resources_payload.resources.flags
        if data.resources_payload.resources
        else []
    ) or []
    selected_enriched_flags = [
        f for f in all_enriched_flags if f.flag_option_id in selected_flag_ids
    ]

    # Build views (always construct — both fields optional now)
    entries = SimulationWebsocketEntries(
        draft_simulation=draft_view,
        runs=runs_result,
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    tools = tools_result or []
    config_args = None
    config_args_outputs = None
    if tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in tools:
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

    websocket_config = WebsocketConfig(
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
    )

    return GetSimulationWebsocketResponse(
        group_id=data.group_id,
        entries=entries if draft_view or runs_result else None,
        resource_agent_ids=data.agent_ids,
        resources=SimulationWebsocketResources(
            names=current.names if current else None,
            descriptions=current.descriptions if current else None,
            flags=selected_enriched_flags or None,
            departments=current.departments if current else None,
            scenarios=current.scenarios if current else None,
            scenario_flags=current.scenario_flags if current else None,
            scenario_positions=current.scenario_positions if current else None,
            scenario_rubrics=current.scenario_rubrics if current else None,
            scenario_time_limits=current.scenario_time_limits if current else None,
            rubrics=(
                data.resources_payload.resources.rubrics
                if data.resources_payload.resources
                else None
            ),
        ),
        config=websocket_config,
    )


async def get_simulation_client(
    profile_id: UUID,
    simulation_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    scenario_search: str | None = None,
    filter_scenario_ids: list[UUID] | None = None,
) -> GetSimulationApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_simulation_internal(
        profile_id=profile_id,
        simulation_id=simulation_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        scenario_search=scenario_search,
        filter_scenario_ids=filter_scenario_ids,
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

    return GetSimulationApiResponse(
        actor_name=data.actor_name,
        simulation_exists=data.simulation_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        names=SimulationNameSection(
            resource=(
                current_bucket.names[0]
                if current_bucket and current_bucket.names
                else None
            ),
            resources=(resources_bucket.names if resources_bucket else None),
            **section_common("names"),
        ),
        descriptions=SimulationDescriptionSection(
            resource=(
                current_bucket.descriptions[0]
                if current_bucket and current_bucket.descriptions
                else None
            ),
            resources=(resources_bucket.descriptions if resources_bucket else None),
            **section_common("descriptions"),
        ),
        flags=SimulationFlagSection(
            current=(current_bucket.flags if current_bucket else None),
            resources=(resources_bucket.flags if resources_bucket else None),
            **section_common("flags"),
        ),
        departments=SimulationDepartmentSection(
            current=(current_bucket.departments if current_bucket else None),
            resources=(resources_bucket.departments if resources_bucket else None),
            **section_common("departments"),
        ),
        scenarios=SimulationScenarioSection(
            current=(current_bucket.scenarios if current_bucket else None),
            resources=(resources_bucket.scenarios if resources_bucket else None),
            **section_common("scenarios"),
        ),
        scenario_flags=SimulationScenarioFlagSection(
            current=(current_bucket.scenario_flags if current_bucket else None),
            resources=(resources_bucket.scenario_flags if resources_bucket else None),
            **section_common("scenario_flags"),
        ),
        scenario_positions=SimulationScenarioPositionSection(
            current=(current_bucket.scenario_positions if current_bucket else None),
            resources=(
                resources_bucket.scenario_positions if resources_bucket else None
            ),
            **section_common("scenario_positions"),
        ),
        scenario_rubrics=SimulationScenarioRubricSection(
            current=(current_bucket.scenario_rubrics if current_bucket else None),
            resources=(resources_bucket.scenario_rubrics if resources_bucket else None),
            **section_common("scenario_rubrics"),
        ),
        scenario_time_limits=SimulationScenarioTimeLimitSection(
            current=(current_bucket.scenario_time_limits if current_bucket else None),
            resources=(
                resources_bucket.scenario_time_limits if resources_bucket else None
            ),
            **section_common("scenario_time_limits"),
        ),
        rubrics=(resources_bucket.rubrics if resources_bucket else None),
    )


@router.post(
    "/get",
    response_model=GetSimulationApiResponse,
    dependencies=[
        audit_activity(
            "simulation.get",
            "{{ actor.name }} {% if simulation %}viewed{% else %}opened new{% endif %} simulation{% if simulation %} '{{ simulation.name }}'{% endif %}",
        )
    ],
)
async def get_simulation(
    request: GetSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationApiResponse:
    """Get simulation information using two-pass architecture.

    This is a thin HTTP wrapper around get_simulation_client().
    """
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_simulation_client(
            profile_id=profile_id,
            simulation_id=request.simulation_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            scenario_search=request.scenario_search,
            filter_scenario_ids=request.filter_scenario_ids,
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = (
                getattr(response_data.names.resource, "name", None)
                if response_data.names and response_data.names.resource
                else None
            )
            if request.simulation_id and current_name:
                audit_ctx["simulation"] = {
                    "name": current_name,
                    "id": str(request.simulation_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "simulations"
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
            operation="get_simulation",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

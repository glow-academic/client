"""Rubric get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_rubric_internal() - Core data fetching (cacheable, returns dataclass)
2. get_rubric_websocket() - Minimal data for WebSocket handlers
3. get_rubric_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.rubric.permissions import (
    RUBRIC_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_pass_points_required,
    compute_points_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_pass_points,
    compute_show_points,
    compute_show_standard_groups,
    compute_show_standards,
    compute_standard_groups_required,
    compute_standards_required,
    has_access,
)
from app.api.v4.artifacts.rubric.types import (
    GetRubricApiRequest,
    GetRubricApiResponse,
    GetRubricWebsocketResponse,
    RubricDepartmentSection,
    RubricDescriptionSection,
    RubricFlagConfig,
    RubricFlagSection,
    RubricNameSection,
    RubricPassPointsSection,
    RubricPointsSection,
    RubricStandardGroupsSection,
    RubricStandardsSection,
    RubricWebsocketEntries,
    RubricWebsocketResources,
)
from app.api.v4.artifacts.types import WebsocketConfig
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.entries.rubric_drafts.get import get_rubric_drafts_entries_internal
from app.api.v4.entries.runs.search import get_run_list_entries_internal
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
from app.api.v4.resources.points.get import get_points_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.standard_groups.get import get_standard_groups_internal
from app.api.v4.resources.standards.get import get_standards_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetRubricAccessSqlParams,
    GetRubricAccessSqlRow,
    GetRubricIdsSqlParams,
    GetRubricIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/rubrics/get_rubric_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/rubrics/get_rubric_ids_complete.sql"

router = APIRouter()


@dataclass
class RubricInternalData:
    """Internal data from core rubric fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_rubric_websocket() - minimal data for WebSocket handlers
    - get_rubric_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    rubric_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Agent mappings (resource_type -> agent_id)
    resource_agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: agent exists)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    content_show_ai_generate: bool

    # Resources
    names: list[Any]
    descriptions: list[Any]
    flags: list[RubricFlagConfig]
    departments: list[Any]
    points: list[Any]
    pass_points: list[Any]
    standard_groups: list[Any]
    standards: list[Any]
    names_current: list[Any]
    descriptions_current: list[Any]
    flags_current: list[RubricFlagConfig]
    departments_current: list[Any]
    points_current: list[Any]
    pass_points_current: list[Any]
    standard_groups_current: list[Any]
    standards_current: list[Any]

    # Config resources for websocket generation context
    config_agents: list[Any]
    config_models: list[Any]
    config_providers: list[Any]
    config_tools: list[Any]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_rubric_internal(
    profile_id: UUID,
    rubric_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> RubricInternalData:
    """Core data fetching layer (cacheable).

    Fetches all rubric data using two-pass architecture and returns
    a dataclass with all computed values. This is the shared layer used by:
    - get_rubric_websocket() - minimal data for WebSocket handlers
    - get_rubric_client() - full BFF response for HTTP/frontend
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Resolve shared profile context first (default path).
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
            draft_items = await get_rubric_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetRubricAccessSqlParams(
            profile_id=profile_id,
            rubric_id=rubric_id,
            draft_id=draft_id,
            draft_group_id=draft_item.group_id if draft_item is not None else None,
            draft_version=draft_item.version if draft_item is not None else None,
        )

        access_result = cast(
            GetRubricAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract artifact-specific state from Query 1 (no user context)
        rubric_department_ids = access_result.rubric_department_ids or []
        active_simulation_count = access_result.active_simulation_count or 0

        # Early validation: check rubric exists
        if rubric_id is not None:
            if access_result.rubric_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Rubric {rubric_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, rubric_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this rubric. It may be restricted to other departments.",
                )

        # group_id is guaranteed by SQL (created inline if no draft)
        effective_group_id = access_result.group_id
        effective_draft_version = access_result.effective_draft_version

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetRubricIdsSqlParams(
            profile_id=profile_id,
            rubric_id=rubric_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetRubricIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_total_points_id = ids_result.total_points_id
    selected_pass_points_id = ids_result.pass_points_id

    selected_department_ids = ids_result.department_ids or []
    selected_standard_group_ids = ids_result.standard_group_ids or []
    selected_standard_ids = ids_result.standard_ids or []

    # Draft values override canonical rubric-junction values.
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids
        if draft_item.point_ids:
            selected_total_points_id = draft_item.point_ids[0]
            selected_pass_points_id = (
                draft_item.point_ids[1]
                if len(draft_item.point_ids) > 1
                else draft_item.point_ids[0]
            )
        if draft_item.standard_group_ids:
            selected_standard_group_ids = draft_item.standard_group_ids
        if draft_item.standard_ids:
            selected_standard_ids = draft_item.standard_ids

    # === RESOLVE AGENTS FROM SETTINGS ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    resource_agent_ids, create_tool_ids_map, link_tool_ids_map = (
        resolve_agents_for_artifact(settings_data.agent_tool_entries, RUBRIC_RESOURCES)
    )
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        """Returns True if an agent exists for that resource."""
        return resource_agent_ids.get(resource) is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")
    points_show_ai_generate = compute_show_ai_generate("points")
    pass_points_show_ai_generate = compute_show_ai_generate("pass_points")
    standard_groups_show_ai_generate = compute_show_ai_generate("standard_groups")
    standards_show_ai_generate = compute_show_ai_generate("standards")

    # Step-level show_ai_generate flags
    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
            departments_show_ai_generate,
        ]
    )
    content_show_ai_generate = any(
        [
            points_show_ai_generate,
            pass_points_show_ai_generate,
            standard_groups_show_ai_generate,
            standards_show_ai_generate,
        ]
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        rubric_department_ids=rubric_department_ids,
        active_simulation_count=active_simulation_count,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        rubric_department_ids=rubric_department_ids,
        active_simulation_count=active_simulation_count,
    )

    # === PASS 2: Parallel Resource Fetching ===

    # Selected IDs for fetching
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    department_ids = selected_department_ids
    total_points_ids = [selected_total_points_id] if selected_total_points_id else []
    pass_points_ids = [selected_pass_points_id] if selected_pass_points_id else []
    standard_group_ids = selected_standard_group_ids
    standard_ids = selected_standard_ids

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
                rubric=True,
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
                rubric=True,
            )
            return (selected, suggestions)

    RUBRIC_FLAG_NAMES = {"rubric_active"}

    async def fetch_flags() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache,
                rubric=True,
            )
            suggestions = [f for f in all_flags if f.name in RUBRIC_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=department_ids,
                bypass_cache=bypass_cache,
                rubric=True,
            )
            return (selected, suggestions)

    async def fetch_points() -> list[Any]:
        async with pool.acquire() as c:
            return await get_points_internal(c, total_points_ids, bypass_cache)

    async def fetch_pass_points() -> list[Any]:
        async with pool.acquire() as c:
            return await get_points_internal(c, pass_points_ids, bypass_cache)

    async def fetch_standard_groups() -> list[Any]:
        async with pool.acquire() as c:
            return await get_standard_groups_internal(
                c, standard_group_ids, bypass_cache
            )

    async def fetch_standards() -> list[Any]:
        async with pool.acquire() as c:
            return await get_standards_internal(c, standard_ids, bypass_cache)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        points_selected,
        pass_points_selected,
        standard_groups_selected,
        standards_selected,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_points(),
        fetch_pass_points(),
        fetch_standard_groups(),
        fetch_standards(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )

    # Find selected resources
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]

    # Points resources - selected are the current
    total_points_resource = points_selected[0] if points_selected else None
    pass_points_resource = pass_points_selected[0] if pass_points_selected else None

    name_suggestion_ids = [n.id for n in names_suggestions]
    description_suggestion_ids = [d.id for d in descriptions_suggestions]
    department_suggestion_ids = [d.department_id for d in departments_suggestions]
    points_suggestion_ids: list[UUID] = []
    pass_points_suggestion_ids: list[UUID] = []
    standard_group_suggestion_ids: list[UUID] = []
    standard_suggestion_ids: list[UUID] = []

    # Compute final show flags based on actual data
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_points_flag = compute_show_points()
    show_pass_points_flag = compute_show_pass_points()
    show_standard_groups_flag = compute_show_standard_groups()
    show_standards_flag = compute_show_standards(len(standard_groups_selected))

    # Build show and required flags maps for section metadata.
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "points": show_points_flag,
        "pass_points": show_pass_points_flag,
        "standard_groups": show_standard_groups_flag,
        "standards": show_standards_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "points": compute_points_required(),
        "pass_points": compute_pass_points_required(),
        "standard_groups": compute_standard_groups_required(),
        "standards": compute_standards_required(),
    }

    # Transform flags to enriched format for client
    rubric_flags = [
        RubricFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flag,
            required=compute_flag_required(),
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
    ]

    # Validation for new mode
    if rubric_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Detail mode: check access via name_resource
    if rubric_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this rubric. It may be restricted to other departments.",
        )

    # Fetch config resources for websocket generation context.
    config_agent_resource_ids = [a.id for a in settings_data.settings_agents if a.id]
    config_model_resource_ids = [
        a.model_id for a in settings_data.settings_agents if a.model_id
    ]

    config_agents: list[Any] = []
    config_models: list[Any] = []
    config_providers: list[Any] = []
    config_tools: list[Any] = []
    if config_agent_resource_ids:
        async with pool.acquire() as c:
            config_agents = await get_agents_internal(
                c,
                config_agent_resource_ids,
                bypass_cache=bypass_cache,
            )
    if config_model_resource_ids:
        async with pool.acquire() as c:
            config_models = await get_models_internal(
                c,
                config_model_resource_ids,
                bypass_cache=bypass_cache,
            )
    provider_ids = list(
        dict.fromkeys(
            [m.provider_id for m in config_models if m.provider_id is not None]
        )
    )
    if provider_ids:
        async with pool.acquire() as c:
            config_providers = await get_providers_internal(
                c,
                provider_ids,
                bypass_cache=bypass_cache,
            )
    tool_ids: list[UUID] = []
    for agent in config_agents:
        raw = getattr(agent, "tool_ids", None) or []
        tool_ids.extend([tid for tid in raw if tid is not None])
    tool_ids = list(dict.fromkeys(tool_ids))
    if tool_ids:
        async with pool.acquire() as c:
            config_tools = await get_tools_internal(
                c,
                tool_ids,
                bypass_cache=bypass_cache,
            )

    # Build show_ai_generate map
    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "descriptions": description_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
        "points": points_show_ai_generate,
        "pass_points": pass_points_show_ai_generate,
        "standard_groups": standard_groups_show_ai_generate,
        "standards": standards_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestion_ids,
        "descriptions": description_suggestion_ids,
        "departments": department_suggestion_ids,
        "points": points_suggestion_ids,
        "pass_points": pass_points_suggestion_ids,
        "standard_groups": standard_group_suggestion_ids,
        "standards": standard_suggestion_ids,
    }

    return RubricInternalData(
        # Access/context
        actor_name=actor_name,
        rubric_exists=access_result.rubric_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        # Agent mappings
        resource_agent_ids=resource_agent_ids,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        content_show_ai_generate=content_show_ai_generate,
        # Resources
        names=names,
        descriptions=descriptions,
        flags=rubric_flags,
        departments=departments,
        points=points_selected,
        pass_points=pass_points_selected,
        standard_groups=standard_groups_selected,
        standards=standards_selected,
        names_current=[name_resource] if name_resource else [],
        descriptions_current=[description_resource] if description_resource else [],
        flags_current=[
            f for f in rubric_flags if f.flag_option_id == selected_active_flag_id
        ],
        departments_current=department_resources or [],
        points_current=[total_points_resource] if total_points_resource else [],
        pass_points_current=[pass_points_resource] if pass_points_resource else [],
        standard_groups_current=standard_groups_selected,
        standards_current=standards_selected,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        # Per-resource tool IDs
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_rubric_websocket(
    profile_id: UUID,
    rubric_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetRubricWebsocketResponse:
    """Websocket response using views/resources pattern."""
    from datetime import UTC, datetime

    data = await get_rubric_internal(
        profile_id=profile_id,
        rubric_id=rubric_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # Fetch draft rubric view, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_rubric_drafts_entries_internal(
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
        if not data.config_agents or not pool:
            return []
        agent_resource = data.config_agents[0]
        if not agent_resource or not agent_resource.tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools_internal(
                c, list(agent_resource.tool_ids), bypass_cache
            )

    (
        draft_rubric,
        config_profile_result,
        runs_result,
        tools_result,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_args = None
    config_args_outputs = None
    if tools_result and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in tools_result:
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
        agents=data.config_agents,
        models=data.config_models,
        providers=data.config_providers,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
    )

    return GetRubricWebsocketResponse(
        entries=RubricWebsocketEntries(
            draft_rubric=draft_rubric,
            runs=runs_result or None,
        ),
        resources=RubricWebsocketResources(
            names=data.names_current,
            descriptions=data.descriptions_current,
            flags=data.flags_current,
            departments=data.departments_current,
            points=data.points_current,
            pass_points=data.pass_points_current,
            standard_groups=data.standard_groups_current,
            standards=data.standards_current,
        ),
        config=websocket_config,
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def get_rubric_client(
    profile_id: UUID,
    rubric_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetRubricApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags.
    """
    data = await get_rubric_internal(
        profile_id=profile_id,
        rubric_id=rubric_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetRubricApiResponse(
        actor_name=data.actor_name,
        rubric_exists=data.rubric_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        content_show_ai_generate=data.content_show_ai_generate,
        names=RubricNameSection(
            show=data.show_flags_map.get("names", False),
            required=data.required_flags_map.get("names", False),
            suggestions=data.suggestions_map.get("names"),
            show_ai_generate=data.show_ai_generate_map.get("names", False),
            create_tool_id=data.create_tool_ids_map.get("names"),
            link_tool_id=data.link_tool_ids_map.get("names"),
            resource=data.names_current[0] if data.names_current else None,
            resources=data.names,
        ),
        descriptions=RubricDescriptionSection(
            show=data.show_flags_map.get("descriptions", False),
            required=data.required_flags_map.get("descriptions", False),
            suggestions=data.suggestions_map.get("descriptions"),
            show_ai_generate=data.show_ai_generate_map.get("descriptions", False),
            create_tool_id=data.create_tool_ids_map.get("descriptions"),
            link_tool_id=data.link_tool_ids_map.get("descriptions"),
            resource=data.descriptions_current[0]
            if data.descriptions_current
            else None,
            resources=data.descriptions,
        ),
        flags=RubricFlagSection(
            show=data.show_flags_map.get("flags", False),
            required=data.required_flags_map.get("flags", False),
            show_ai_generate=data.show_ai_generate_map.get("flags", False),
            link_tool_id=data.link_tool_ids_map.get("flags"),
            current=data.flags_current,
            resources=data.flags,
        ),
        departments=RubricDepartmentSection(
            show=data.show_flags_map.get("departments", False),
            required=data.required_flags_map.get("departments", False),
            suggestions=data.suggestions_map.get("departments"),
            show_ai_generate=data.show_ai_generate_map.get("departments", False),
            link_tool_id=data.link_tool_ids_map.get("departments"),
            current=data.departments_current,
            resources=data.departments,
        ),
        points=RubricPointsSection(
            show=data.show_flags_map.get("points", False),
            required=data.required_flags_map.get("points", False),
            suggestions=data.suggestions_map.get("points"),
            show_ai_generate=data.show_ai_generate_map.get("points", False),
            create_tool_id=data.create_tool_ids_map.get("points"),
            link_tool_id=data.link_tool_ids_map.get("points"),
            resource=data.points_current[0] if data.points_current else None,
            resources=data.points,
        ),
        pass_points=RubricPassPointsSection(
            show=data.show_flags_map.get("pass_points", False),
            required=data.required_flags_map.get("pass_points", False),
            suggestions=data.suggestions_map.get("pass_points"),
            show_ai_generate=data.show_ai_generate_map.get("pass_points", False),
            create_tool_id=data.create_tool_ids_map.get("pass_points"),
            link_tool_id=data.link_tool_ids_map.get("pass_points"),
            resource=data.pass_points_current[0] if data.pass_points_current else None,
            resources=data.pass_points,
        ),
        standard_groups=RubricStandardGroupsSection(
            show=data.show_flags_map.get("standard_groups", False),
            required=data.required_flags_map.get("standard_groups", False),
            suggestions=data.suggestions_map.get("standard_groups"),
            show_ai_generate=data.show_ai_generate_map.get("standard_groups", False),
            create_tool_id=data.create_tool_ids_map.get("standard_groups"),
            link_tool_id=data.link_tool_ids_map.get("standard_groups"),
            current=data.standard_groups_current,
            resources=data.standard_groups,
        ),
        standards=RubricStandardsSection(
            show=data.show_flags_map.get("standards", False),
            required=data.required_flags_map.get("standards", False),
            suggestions=data.suggestions_map.get("standards"),
            show_ai_generate=data.show_ai_generate_map.get("standards", False),
            link_tool_id=data.link_tool_ids_map.get("standards"),
            current=data.standards_current,
            resources=data.standards,
        ),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'rubric_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("rubric_", "")
    label = key.replace("_", " ").title()
    return (key, label)


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


@router.post(
    "/get",
    response_model=GetRubricApiResponse,
    dependencies=[
        audit_activity(
            "rubric.get",
            "{{ actor.name }} {% if rubric %}viewed{% else %}opened new{% endif %} rubric{% if rubric %} '{{ rubric.name }}'{% endif %}",
        )
    ],
)
async def get_rubric(
    request: GetRubricApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRubricApiResponse:
    """Get rubric information using two-pass architecture.

    Query 1: Access check (user role, departments, rubric state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_rubric_client(
            profile_id=profile_id,
            rubric_id=request.rubric_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = (
                response_data.names.resource.name
                if (response_data.names and response_data.names.resource)
                else None
            )
            if request.rubric_id and current_name:
                audit_ctx["rubric"] = {
                    "name": current_name,
                    "id": str(request.rubric_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "rubrics"
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
            operation="get_rubric",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

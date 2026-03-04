"""Eval get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_eval_internal() - Core data fetching (cacheable, returns dataclass)
2. get_eval_websocket() - Minimal data for WebSocket handlers
3. get_eval_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from datetime import UTC
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.eval.permissions import (
    EVAL_RESOURCES,
    compute_active_flag_required,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_name_required,
    compute_rubrics_required,
    compute_show_active_flag,
    compute_show_departments,
    compute_show_description,
    compute_show_name,
    compute_show_rubrics,
    has_access,
)
from app.routes.v5.api.main.eval.types import (
    EvalAgentItem,
    EvalAgentSection,
    EvalDepartmentSection,
    EvalDescriptionSection,
    EvalFlagConfig,
    EvalFlagSection,
    EvalGroupRubricMapping,
    EvalGroupSection,
    EvalNameSection,
    EvalRubricItem,
    EvalRubricSection,
    EvalRunRubricMapping,
    EvalRunSection,
    EvalWebsocketEntries,
    EvalWebsocketResources,
    GetEvalApiRequest,
    GetEvalApiResponse,
    GetEvalWebsocketResponse,
)
from app.routes.v5.api.permissions import (
    has_tools_for_resource,
    resolve_agents_for_artifact,
)
from app.routes.v5.tools.entries.eval_drafts.get import get_eval_drafts_entries_internal
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.departments.get import get_departments_internal
from app.routes.v5.tools.resources.departments.search import search_departments_internal
from app.routes.v5.tools.resources.descriptions.get import get_descriptions_internal
from app.routes.v5.tools.resources.descriptions.search import (
    search_descriptions_internal,
)
from app.routes.v5.tools.resources.flags.get import get_flags_internal
from app.routes.v5.tools.resources.flags.search import search_flags_internal
from app.routes.v5.tools.resources.models.get import get_models_internal
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names_internal
from app.routes.v5.tools.resources.profiles.get import get_profiles_internal
from app.routes.v5.tools.resources.providers.get import get_providers_internal
from app.routes.v5.tools.resources.rubrics.get import get_rubrics_batch_internal
from app.routes.v5.tools.resources.tools.get import get_tools
from app.sql.types import (
    GetEvalAccessSqlParams,
    GetEvalAccessSqlRow,
    GetEvalIdsSqlParams,
    GetEvalIdsSqlRow,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/queries/evals/get_eval_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/evals/get_eval_ids_complete.sql"

router = APIRouter()


@dataclass
class EvalInternalData:
    """Internal data from core eval fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_eval_websocket() - minimal data for WebSocket handlers
    - get_eval_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    eval_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Agent mappings
    resource_agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool

    # Hydrated resources
    names: list[Any]
    descriptions: list[Any]
    flags: list[EvalFlagConfig]
    departments: list[Any]
    eval_agents: list[EvalAgentItem]
    rubrics: list[EvalRubricItem]
    config_agents: list[Any]
    config_models: list[Any]
    config_providers: list[Any]
    config_tools: list[Any]
    available_model_runs: list[Any]
    available_model_runs_total_count: int | None
    available_model_runs_page: int | None
    available_model_runs_page_size: int | None
    available_model_runs_total_pages: int | None
    available_groups: list[Any]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Selected resource IDs
    name_id: UUID | None
    description_id: UUID | None
    active_flag_id: UUID | None
    dynamic_flag_id: UUID | None
    groups_flag_id: UUID | None
    department_ids: list[UUID]
    rubric_ids: list[UUID]
    model_ids: list[UUID]
    model_flag_ids: list[UUID]
    model_rubric_ids: list[UUID]
    model_position_ids: list[UUID]


async def get_eval_internal(
    profile_id: UUID,
    eval_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
    # Search/filter kwargs (threaded from websocket artifact tool)
    agent_search: str | None = None,
    group_search: str | None = None,
    available_model_runs_search: str | None = None,
    available_model_runs_agent_ids: list[UUID] | None = None,
    available_model_runs_page: int | None = 1,
    available_model_runs_page_size: int | None = 50,
) -> EvalInternalData:
    """Core data fetching layer (cacheable).

    Fetches all eval data using two-pass architecture and returns
    a dataclass with all computed values.
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_eval_drafts_entries_internal(
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

    async with pool.acquire() as conn:
        query1_params = GetEvalAccessSqlParams(
            profile_id=profile_id,
            eval_id=eval_id,
            draft_id=draft_id,
            draft_group_id=group_id
            or (draft_item.group_id if draft_item is not None else None),
            draft_version=draft_item.version if draft_item is not None else None,
        )

        access_result = cast(
            GetEvalAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        eval_department_ids = access_result.eval_department_ids or []
        active_usage_count = access_result.active_usage_count or 0

        # Early validation: check eval exists
        if eval_id is not None:
            if access_result.eval_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Eval {eval_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, eval_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this eval. It may be restricted to other departments.",
                )

        # Use provided group_id, or fall back to SQL-created one
        effective_group_id = group_id or access_result.group_id
        effective_draft_version = access_result.effective_draft_version

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetEvalIdsSqlParams(
            profile_id=profile_id,
            eval_id=eval_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetEvalIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_dynamic_flag_id = ids_result.dynamic_flag_id
    selected_groups_flag_id = ids_result.groups_flag_id

    selected_department_ids = ids_result.department_ids or []

    # Draft values override canonical junction values
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids

    # === RESOLVE AGENTS FROM SETTINGS ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, EVAL_RESOURCES
    )
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        agent_id = agent_ids.get(resource)
        return agent_id is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")
    rubrics_show_ai_generate = compute_show_ai_generate("rubrics")

    # Step-level show_ai_generate flags
    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
            departments_show_ai_generate,
        ]
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(user_role=user_role)

    disabled_reason = compute_disabled_reason(user_role=user_role)

    # === PASS 2: Parallel Resource Fetching ===

    # Selected IDs for fetching
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    active_flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    dynamic_flag_ids = [selected_dynamic_flag_id] if selected_dynamic_flag_id else []
    groups_flag_ids = [selected_groups_flag_id] if selected_groups_flag_id else []
    all_flag_ids = active_flag_ids + dynamic_flag_ids + groups_flag_ids
    department_ids = selected_department_ids
    selected_rubric_ids = ids_result.rubric_ids or []
    rubric_suggestion_ids = ids_result.rubric_suggestions or []

    async def fetch_names() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_names(c, name_ids, cache)
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                None,
                name_ids,
                bypass_cache,
                eval=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_descriptions_internal(c, description_ids, cache)
            suggestions = await search_descriptions_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                description_ids,
                bypass_cache,
                eval=True,
            )
            return (selected, suggestions)

    # Eval-specific flag names
    EVAL_FLAG_NAMES = {"eval_active", "dynamic", ""}

    async def fetch_flags() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, all_flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                all_flag_ids,
                bypass_cache,
                eval=True,
            )
            suggestions = [f for f in all_flags if f.name in EVAL_FLAG_NAMES]
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
                cache=cache,
                eval=True,
            )
            return (selected, suggestions)

    async def fetch_rubrics() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_rubrics_batch_internal(
                c, selected_rubric_ids, bypass_cache
            )
            suggestions = await get_rubrics_batch_internal(
                c, rubric_suggestion_ids, bypass_cache
            )
            return (selected, suggestions)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (rubrics_selected, rubrics_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_rubrics(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    rubrics = _dedupe_by_id(rubrics_selected + rubrics_suggestions, "id")

    # Find selected resources
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    name_suggestion_ids = [n.id for n in names_suggestions]
    description_suggestion_ids = [d.id for d in descriptions_suggestions]
    department_suggestion_ids = [d.department_id for d in departments_suggestions]
    rubric_suggestion_ids_out = [r.id for r in rubrics_suggestions if r.id]

    # Compute show flags
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_active_flag = compute_show_active_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_agents_flag = False
    show_rubrics_flag = compute_show_rubrics(len(ids_result.rubric_ids or []))

    # Build show and required flags maps for domain_data
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_active_flag,
        "departments": show_departments_flag,
        "rubrics": show_rubrics_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_active_flag_required(),
        "departments": compute_departments_required(show_departments_flag),
        "rubrics": compute_rubrics_required(show_rubrics_flag),
    }

    # Transform flags to enriched format for client
    eval_flags = [
        EvalFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_active_flag,
            required=compute_active_flag_required(),
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
    ]

    eval_agents: list[EvalAgentItem] = []

    eval_rubrics = [
        EvalRubricItem(
            id=r.id,
            name=r.name,
            description=r.description,
            generated=bool(r.generated),
        )
        for r in rubrics
        if r.id
    ]

    # Validation for new mode
    if eval_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Detail mode: check access via name_resource
    if eval_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this eval. It may be restricted to other departments.",
        )

    # Build show_ai_generate map
    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "descriptions": description_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
        "rubrics": rubrics_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestion_ids,
        "descriptions": description_suggestion_ids,
        "departments": department_suggestion_ids,
        "rubrics": cast(list[UUID], rubric_suggestion_ids_out),
    }

    # Config chain hydration for websocket generation parity.
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
                c, config_agent_resource_ids, bypass_cache
            )
    if config_model_resource_ids:
        async with pool.acquire() as c:
            config_models = await get_models_internal(
                c, config_model_resource_ids, bypass_cache
            )
        provider_ids = list({m.provider_id for m in config_models if m.provider_id})
        if provider_ids:
            async with pool.acquire() as c:
                config_providers = await get_providers_internal(
                    c, provider_ids, bypass_cache
                )
    tool_ids = list({tid for a in config_agents for tid in (a.tool_ids or []) if tid})
    if tool_ids:
        async with pool.acquire() as c:
            config_tools = await get_tools(c, tool_ids, cache)

    return EvalInternalData(
        # Access/context
        actor_name=actor_name,
        eval_exists=access_result.eval_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        resource_agent_ids=agent_ids,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        # Hydrated resources
        names=names,
        descriptions=descriptions,
        flags=eval_flags,
        departments=departments,
        eval_agents=eval_agents,
        rubrics=eval_rubrics,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        available_model_runs=[],
        available_model_runs_total_count=0,
        available_model_runs_page=1,
        available_model_runs_page_size=50,
        available_model_runs_total_pages=0,
        available_groups=[],
        # Per-resource tool IDs
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        # Selected resource IDs
        name_id=selected_name_id,
        description_id=selected_description_id,
        active_flag_id=selected_active_flag_id,
        dynamic_flag_id=selected_dynamic_flag_id,
        groups_flag_id=selected_groups_flag_id,
        department_ids=selected_department_ids,
        rubric_ids=ids_result.rubric_ids or [],
        model_ids=ids_result.model_ids or [],
        model_flag_ids=ids_result.model_flag_ids or [],
        model_rubric_ids=ids_result.model_rubric_ids or [],
        model_position_ids=ids_result.model_position_ids or [],
    )


async def get_eval_websocket(
    profile_id: UUID,
    eval_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    # Search/filter kwargs (from artifact tool calls)
    agent_search: str | None = None,
    group_search: str | None = None,
    available_model_runs_search: str | None = None,
    available_model_runs_agent_ids: list[UUID] | None = None,
    available_model_runs_page: int | None = 1,
    available_model_runs_page_size: int | None = 50,
) -> GetEvalWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns only what's needed for AI generation:
    - Group ID (for existing group context)
    - Selected resources (for Jinja template context)
    - resource_agent_ids (server-side agent routing)
    """
    data = await get_eval_internal(
        profile_id=profile_id,
        eval_id=eval_id,
        draft_id=draft_id,
        cache=cache,
        agent_search=agent_search,
        group_search=group_search,
        available_model_runs_search=available_model_runs_search,
        available_model_runs_agent_ids=available_model_runs_agent_ids,
        available_model_runs_page=available_model_runs_page,
        available_model_runs_page_size=available_model_runs_page_size,
    )

    # Fetch draft, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_eval_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            return draft_items[0] if draft_items else None

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn, [profile_id], cache)

    async def fetch_runs_today():
        if not pool:
            return None
        from datetime import datetime

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
        agent_resource = data.config_agents[0] if data.config_agents else None
        if not agent_resource or not agent_resource.tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools(
                c, list(agent_resource.tool_ids), cache
            )

    (
        draft_eval,
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
                    return await get_args(
                        c, list(set(all_args_ids)), cache=cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c, list(set(all_args_output_ids)), cache=cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    selected_name = next((n for n in data.names if n.id == data.name_id), None)
    selected_description = next(
        (d for d in data.descriptions if d.id == data.description_id), None
    )
    selected_flags = [
        f
        for f in data.flags
        if f.flag_option_id
        and f.flag_option_id
        in {
            data.active_flag_id,
            data.dynamic_flag_id,
            data.groups_flag_id,
        }
    ]
    selected_departments = [
        d for d in data.departments if d.department_id in data.department_ids
    ]
    selected_agents = [a for a in data.eval_agents if a.id in set()]
    selected_rubrics = [r for r in data.rubrics if r.id in set(data.rubric_ids)]

    # Build entries (always construct -- both fields optional now)
    entries = EvalWebsocketEntries(
        draft_eval=draft_eval,
        runs=runs_result,
    )

    websocket_resources = EvalWebsocketResources(
        names=[selected_name] if selected_name else [],
        descriptions=[selected_description] if selected_description else [],
        flags=selected_flags,
        departments=selected_departments,
        eval_agents=selected_agents,
        rubrics=selected_rubrics,
        model_flags=None,
        model_rubrics=None,
        model_positions=None,
    )

    return GetEvalWebsocketResponse(
        entries=entries if draft_eval or runs_result else None,
        group_id=data.group_id,
        resource_agent_ids=data.resource_agent_ids,
        resources=websocket_resources,
        agents=data.config_agents,
        models=data.config_models,
        providers=data.config_providers,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetEvalApiRequest(
            eval_id=eval_id,
            draft_id=draft_id,
            agent_search=agent_search,
            group_search=group_search,
            available_model_runs_search=available_model_runs_search,
            available_model_runs_agent_ids=available_model_runs_agent_ids,
            available_model_runs_page=available_model_runs_page,
            available_model_runs_page_size=available_model_runs_page_size,
        ),
    )


async def get_eval_client(
    profile_id: UUID,
    eval_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetEvalApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags.
    """
    data = await get_eval_internal(
        profile_id=profile_id,
        eval_id=eval_id,
        draft_id=draft_id,
        cache=cache,
        group_id=group_id,
    )

    active_flag = next(
        (f for f in data.flags if f.flag_option_id == data.active_flag_id), None
    )
    dynamic_flag = next(
        (f for f in data.flags if f.flag_option_id == data.dynamic_flag_id), None
    )
    groups_flag = next(
        (f for f in data.flags if f.flag_option_id == data.groups_flag_id), None
    )

    selected_name = next((n for n in data.names if n.id == data.name_id), None)
    selected_description = next(
        (d for d in data.descriptions if d.id == data.description_id), None
    )
    selected_departments = [
        d for d in data.departments if d.department_id in data.department_ids
    ]
    selected_agents = [a for a in data.eval_agents if a.id in set()]
    selected_rubrics = [r for r in data.rubrics if r.id in set(data.rubric_ids)]

    return GetEvalApiResponse(
        actor_name=data.actor_name,
        eval_exists=data.eval_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        names=EvalNameSection(
            show=data.show_flags_map.get("names", False),
            required=data.required_flags_map.get("names", False),
            suggestions=data.suggestions_map.get("names"),
            show_ai_generate=data.show_ai_generate_map.get("names", False),
            create_tool_id=data.create_tool_ids_map.get("names"),
            link_tool_id=data.link_tool_ids_map.get("names"),
            resource=selected_name,
            resources=data.names,
        ),
        descriptions=EvalDescriptionSection(
            show=data.show_flags_map.get("descriptions", False),
            required=data.required_flags_map.get("descriptions", False),
            suggestions=data.suggestions_map.get("descriptions"),
            show_ai_generate=data.show_ai_generate_map.get("descriptions", False),
            create_tool_id=data.create_tool_ids_map.get("descriptions"),
            link_tool_id=data.link_tool_ids_map.get("descriptions"),
            resource=selected_description,
            resources=data.descriptions,
        ),
        active_flags=EvalFlagSection(
            show=data.show_flags_map.get("flags", False),
            required=data.required_flags_map.get("flags", False),
            show_ai_generate=data.show_ai_generate_map.get("flags", False),
            link_tool_id=data.link_tool_ids_map.get("flags"),
            resource=active_flag,
            resources=data.flags,
        ),
        dynamic_flags=EvalFlagSection(
            show=True,
            required=False,
            show_ai_generate=data.show_ai_generate_map.get("flags", False),
            link_tool_id=data.link_tool_ids_map.get("flags"),
            resource=dynamic_flag,
            resources=data.flags,
        ),
        groups_flags=EvalFlagSection(
            show=True,
            required=False,
            show_ai_generate=data.show_ai_generate_map.get("flags", False),
            link_tool_id=data.link_tool_ids_map.get("flags"),
            resource=groups_flag,
            resources=data.flags,
        ),
        departments=EvalDepartmentSection(
            show=data.show_flags_map.get("departments", False),
            required=data.required_flags_map.get("departments", False),
            suggestions=data.suggestions_map.get("departments"),
            show_ai_generate=data.show_ai_generate_map.get("departments", False),
            link_tool_id=data.link_tool_ids_map.get("departments"),
            current=selected_departments,
            resources=data.departments,
        ),
        agents=EvalAgentSection(
            show=data.show_flags_map.get("agents", False),
            required=data.required_flags_map.get("agents", False),
            suggestions=data.suggestions_map.get("agents"),
            show_ai_generate=data.show_ai_generate_map.get("agents", False),
            link_tool_id=data.link_tool_ids_map.get("agents"),
            current=selected_agents,
            resources=data.eval_agents,
        ),
        rubrics=EvalRubricSection(
            show=data.show_flags_map.get("rubrics", False),
            required=data.required_flags_map.get("rubrics", False),
            suggestions=data.suggestions_map.get("rubrics"),
            show_ai_generate=data.show_ai_generate_map.get("rubrics", False),
            link_tool_id=data.link_tool_ids_map.get("rubrics"),
            current=selected_rubrics,
            resources=data.rubrics,
        ),
        runs=EvalRunSection(
            show=True,
            required=False,
            current=[],
            resources=data.available_model_runs or [],
        ),
        groups=EvalGroupSection(
            show=True,
            required=False,
            current=[],
            resources=data.available_groups or [],
        ),
        run_rubrics=None,
        group_rubrics=None,
        available_model_runs=data.available_model_runs or [],
        available_model_runs_total_count=data.available_model_runs_total_count,
        available_model_runs_page=data.available_model_runs_page,
        available_model_runs_page_size=data.available_model_runs_page_size,
        available_model_runs_total_pages=data.available_model_runs_total_pages,
        available_groups=data.available_groups or [],
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'eval_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("eval_", "")
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


def _parse_run_rubrics(raw: object) -> list[EvalRunRubricMapping]:
    """Parse run_rubrics from SQL composite array."""
    if not raw:
        return []
    result = []
    for item in raw:
        if isinstance(item, tuple) and len(item) >= 2:
            result.append(EvalRunRubricMapping(run_id=item[0], rubric_ids=item[1]))
    return result


def _parse_group_rubrics(raw: object) -> list[EvalGroupRubricMapping]:
    """Parse group_rubrics from SQL composite array."""
    if not raw:
        return []
    result = []
    for item in raw:
        if isinstance(item, tuple) and len(item) >= 2:
            result.append(EvalGroupRubricMapping(group_id=item[0], rubric_ids=item[1]))
    return result


@router.post("/get", response_model=GetEvalApiResponse)
async def get_eval(
    request: GetEvalApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetEvalApiResponse:
    """Get eval information using two-pass architecture.

    This is a thin HTTP wrapper around get_eval_internal().

    Query 1: Access check (user role, departments, eval state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Call the client (BFF) function
        response_data = await get_eval_client(
            profile_id=profile_id,
            eval_id=request.eval_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            group_id=request.group_id,
        )

        # No global cache for this response - individual resources are cached
        response.headers["X-Cache-Tags"] = "evals"
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
            operation="get_eval",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

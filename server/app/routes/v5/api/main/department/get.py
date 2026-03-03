"""Department get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_department_internal() - Core data fetching (cacheable, returns dataclass)
2. get_department_websocket() - Minimal data for WebSocket handlers
3. get_department_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.department.permissions import (
    DEPARTMENT_RESOURCES,
    compute_can_edit,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_settings_required,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_settings,
    has_access,
)
from app.routes.v5.api.main.department.types import (
    DepartmentDescriptionSection,
    DepartmentFlagConfig,
    DepartmentFlagSection,
    DepartmentNameSection,
    DepartmentSettingSection,
    DepartmentWebsocketEntries,
    DepartmentWebsocketResources,
    GetDepartmentApiRequest,
    GetDepartmentApiResponse,
    GetDepartmentWebsocketResponse,
)
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.entries.department_drafts.get import (
    get_department_drafts_entries_internal,
)
from app.routes.v5.api.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.api.permissions import has_tools_for_resource, resolve_agents_for_artifact
from app.routes.v5.api.resources.agents.get import get_agents_internal
from app.routes.v5.api.resources.args.get import get_args_internal
from app.routes.v5.api.resources.args_outputs.get import get_args_outputs_internal
from app.routes.v5.api.resources.descriptions.get import get_descriptions_internal
from app.routes.v5.api.resources.descriptions.search import search_descriptions_internal
from app.routes.v5.api.resources.flags.get import get_flags_internal
from app.routes.v5.api.resources.flags.search import search_flags_internal
from app.routes.v5.api.resources.models.get import get_models_internal
from app.routes.v5.api.resources.names.get import get_names_internal
from app.routes.v5.api.resources.names.search import search_names_internal
from app.routes.v5.api.resources.profiles.get import get_profiles_internal
from app.routes.v5.api.resources.providers.get import get_providers_internal
from app.routes.v5.api.resources.settings.get import get_settings_internal
from app.routes.v5.api.resources.tools.get import get_tools_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    GetDepartmentAccessSqlParams,
    GetDepartmentAccessSqlRow,
    GetDepartmentIdsSqlParams,
    GetDepartmentIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/queries/departments/get_department_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/departments/get_department_ids_complete.sql"

router = APIRouter()


@dataclass
class DepartmentInternalData:
    """Internal data from core department fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_department_websocket() - minimal data for WebSocket handlers
    - get_department_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    department_exists: bool | None
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

    # Show AI generate flags (computed: agent exists for resource)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    settings_step_show_ai_generate: bool

    # Resources
    names: list[Any]
    descriptions: list[Any]
    flags: list[DepartmentFlagConfig]
    settings: list[Any]
    names_current: list[Any]
    descriptions_current: list[Any]
    flags_current: list[DepartmentFlagConfig]
    settings_current: list[Any]

    # Config resources for websocket generation context
    config_agents: list[Any]
    config_models: list[Any]
    config_providers: list[Any]
    config_tools: list[Any]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_department_internal(
    profile_id: UUID,
    department_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> DepartmentInternalData:
    """Core data fetching layer (cacheable).

    Fetches all department data using two-pass architecture and returns
    a dataclass with all computed values.
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_department_drafts_entries_internal(
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
        query1_params = GetDepartmentAccessSqlParams(
            profile_id=profile_id,
            department_id=department_id,
            draft_id=draft_id,
            draft_group_id=draft_item.group_id if draft_item is not None else None,
            draft_version=draft_item.version if draft_item is not None else None,
        )

        access_result = cast(
            GetDepartmentAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        usage_count = access_result.usage_count or 0

        # Early validation: check department exists
        if department_id is not None:
            if access_result.department_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Department {department_id} not found",
                )

            # Check access
            if not has_access(user_role):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this department.",
                )

        # === GROUP ID: Use provided group_id, or fall back to SQL-created one ===
        if group_id:
            effective_group_id = group_id
        else:
            effective_group_id = access_result.group_id
        effective_draft_version = access_result.effective_draft_version

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetDepartmentIdsSqlParams(
            profile_id=profile_id,
            department_id=department_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetDepartmentIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_settings_ids = ids_result.settings_ids or []

    # Draft values override canonical junction values.
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.settings_ids:
            selected_settings_ids = draft_item.settings_ids

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    resource_agent_ids, create_tool_ids_map, link_tool_ids_map = (
        resolve_agents_for_artifact(
            settings_data.agent_tool_entries, DEPARTMENT_RESOURCES
        )
    )

    # Derive has_tools flags from settings
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        return resource_agent_ids.get(resource) is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    settings_show_ai_generate = compute_show_ai_generate("settings")

    # Step-level show_ai_generate flags
    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
        ]
    )
    settings_step_show_ai_generate = settings_show_ai_generate

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        usage_count=usage_count,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        usage_count=usage_count,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []

    # Department-specific flag names
    DEPARTMENT_FLAG_NAMES = {"department_active"}

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
                department=True,
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
                department=True,
            )
            return (selected, suggestions)

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
                department=True,
            )
            suggestions = [f for f in all_flags if f.name in DEPARTMENT_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_settings() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_settings_internal(
                c, selected_settings_ids, bypass_cache
            )
            # No search for settings - they're fetched by ID
            return (selected, [])

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (settings_selected, settings_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_settings(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    settings = _dedupe_by_id(settings_selected + settings_suggestions, "settings_id")

    # Find selected resources
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    settings_resources = [
        s
        for s in settings
        if s.settings_id in [str(sid) for sid in selected_settings_ids]
    ]

    name_suggestion_ids = [n.id for n in names_suggestions]
    description_suggestion_ids = [d.id for d in descriptions_suggestions]
    settings_suggestion_ids: list[UUID] = []

    # Compute final show flags
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_settings_flag = compute_show_settings(len(settings))

    # Build show and required flags maps for section metadata
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "settings": show_settings_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "settings": compute_settings_required(),
    }

    # Transform flags to enriched format for client
    department_flags = [
        DepartmentFlagConfig(
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

    # Detail mode: check access via name_resource
    if department_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this department. It may be restricted to other departments.",
        )

    # Fetch config resources for websocket generation context (from settings agents).
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
                c, config_agent_resource_ids, bypass_cache=bypass_cache
            )
    if config_model_resource_ids:
        async with pool.acquire() as c:
            config_models = await get_models_internal(
                c, config_model_resource_ids, bypass_cache=bypass_cache
            )
        provider_ids = list(
            dict.fromkeys(
                [m.provider_id for m in config_models if m.provider_id is not None]
            )
        )
        if provider_ids:
            async with pool.acquire() as c:
                config_providers = await get_providers_internal(
                    c, provider_ids, bypass_cache=bypass_cache
                )
    tool_ids: list[UUID] = []
    for agent in config_agents:
        raw = getattr(agent, "tool_ids", None) or []
        tool_ids.extend([tid for tid in raw if tid is not None])
    tool_ids = list(dict.fromkeys(tool_ids))
    if tool_ids:
        async with pool.acquire() as c:
            config_tools = await get_tools_internal(
                c, tool_ids, bypass_cache=bypass_cache
            )

    # Build show_ai_generate map
    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "descriptions": description_show_ai_generate,
        "flags": flag_show_ai_generate,
        "settings": settings_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestion_ids,
        "descriptions": description_suggestion_ids,
        "settings": settings_suggestion_ids,
    }

    return DepartmentInternalData(
        actor_name=actor_name,
        department_exists=access_result.department_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        resource_agent_ids=resource_agent_ids,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        settings_step_show_ai_generate=settings_step_show_ai_generate,
        names=names,
        descriptions=descriptions,
        flags=department_flags,
        settings=settings,
        names_current=[name_resource] if name_resource else [],
        descriptions_current=[description_resource] if description_resource else [],
        flags_current=[
            f for f in department_flags if f.flag_option_id == selected_active_flag_id
        ],
        settings_current=settings_resources or [],
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_department_websocket(
    profile_id: UUID,
    department_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetDepartmentWebsocketResponse:
    """Websocket response using views/resources pattern."""
    data = await get_department_internal(
        profile_id=profile_id,
        department_id=department_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # Fetch draft department view, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_department_drafts_entries_internal(
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
        agent_resource = data.config_agents[0] if data.config_agents else None
        if not agent_resource or not agent_resource.tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools_internal(
                c, list(agent_resource.tool_ids), bypass_cache
            )

    (
        draft_department,
        config_profile_result,
        runs_result,
        tools_result,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    # Build entries (always construct — both fields optional now)
    entries = DepartmentWebsocketEntries(
        draft_department=draft_department,
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

    return GetDepartmentWebsocketResponse(
        entries=entries if draft_department or runs_result else None,
        resources=DepartmentWebsocketResources(
            names=data.names_current,
            descriptions=data.descriptions_current,
            flags=data.flags_current,
            settings=data.settings_current,
        ),
        agents=data.config_agents,
        models=data.config_models,
        providers=data.config_providers,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetDepartmentApiRequest(department_id=department_id, draft_id=draft_id),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def get_department_client(
    profile_id: UUID,
    department_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetDepartmentApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags.
    """
    data = await get_department_internal(
        profile_id=profile_id,
        department_id=department_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        group_id=group_id,
    )

    return GetDepartmentApiResponse(
        actor_name=data.actor_name,
        department_exists=data.department_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        names=DepartmentNameSection(
            show=data.show_flags_map.get("names", False),
            required=data.required_flags_map.get("names", False),
            suggestions=data.suggestions_map.get("names"),
            show_ai_generate=data.show_ai_generate_map.get("names", False),
            create_tool_id=data.create_tool_ids_map.get("names"),
            link_tool_id=data.link_tool_ids_map.get("names"),
            resource=data.names_current[0] if data.names_current else None,
            resources=data.names,
        ),
        descriptions=DepartmentDescriptionSection(
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
        flags=DepartmentFlagSection(
            show=data.show_flags_map.get("flags", False),
            required=data.required_flags_map.get("flags", False),
            show_ai_generate=data.show_ai_generate_map.get("flags", False),
            link_tool_id=data.link_tool_ids_map.get("flags"),
            current=data.flags_current,
            resources=data.flags,
        ),
        settings=DepartmentSettingSection(
            show=data.show_flags_map.get("settings", False),
            required=data.required_flags_map.get("settings", False),
            suggestions=data.suggestions_map.get("settings"),
            show_ai_generate=data.show_ai_generate_map.get("settings", False),
            link_tool_id=data.link_tool_ids_map.get("settings"),
            current=data.settings_current,
            resources=data.settings,
        ),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'department_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("department_", "")
    label = key.replace("_", " ").title()
    return (key, label)


def _dedupe_by_id(items: list[Any], id_attr: str) -> list[Any]:
    """Preserve order while deduplicating by id attribute."""
    seen: set = set()
    output: list[Any] = []
    for item in items:
        item_id = getattr(item, id_attr, None)
        if item_id and item_id not in seen:
            seen.add(item_id)
            output.append(item)
    return output


@router.post("/get", response_model=GetDepartmentApiResponse)
async def get_department(
    request: GetDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDepartmentApiResponse:
    """Get department information using two-pass architecture.

    This is a thin HTTP wrapper around get_department_internal().
    """
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_department_client(
            profile_id=profile_id,
            department_id=request.department_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            group_id=request.group_id,
        )

        response.headers["X-Cache-Tags"] = "departments"
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
            operation="get_department",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

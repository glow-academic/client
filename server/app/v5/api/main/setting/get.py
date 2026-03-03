"""Setting get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_setting_internal() - Core data fetching (cacheable, returns dataclass)
2. get_setting_websocket() - Minimal data for WebSocket handlers
3. get_setting_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.setting.permissions import (
    SETTING_RESOURCES,
    compute_auth_item_keys_required,
    compute_auths_required,
    compute_can_edit,
    compute_colors_required,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_profiles_required,
    compute_provider_keys_required,
    compute_roles_required,
    compute_show_ai_generate,
    compute_show_auth_item_keys,
    compute_show_auths,
    compute_show_colors,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_profiles,
    compute_show_provider_keys,
    compute_show_roles,
    derive_flag_key_and_label,
    has_access,
)
from app.v5.api.main.setting.types import (
    GetSettingApiRequest,
    GetSettingApiResponse,
    GetSettingWebsocketResponse,
    SettingAuthItemKeySection,
    SettingAuthSection,
    SettingColorSection,
    SettingDepartmentSection,
    SettingDescriptionSection,
    SettingFlagConfig,
    SettingFlagSection,
    SettingInternalData,
    SettingNameSection,
    SettingProfileSection,
    SettingProviderKeySection,
    SettingResourceBucket,
    SettingResources,
    SettingRoleSection,
    SettingWebsocketEntries,
    SettingWebsocketResources,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.auth.settings import get_auth_settings_internal
from app.v5.api.entries.runs.search import get_run_list_entries_internal
from app.v5.api.entries.setting_drafts.get import get_setting_drafts_entries_internal
from app.v5.api.permissions import resolve_agents_for_artifact
from app.v5.api.resources.agents.get import get_agents_internal
from app.v5.api.resources.args.get import get_args_internal
from app.v5.api.resources.args_outputs.get import get_args_outputs_internal
from app.v5.api.resources.auth_item_keys.get import get_auth_item_keys_internal
from app.v5.api.resources.auth_item_keys.search import search_auth_item_keys_internal
from app.v5.api.resources.auths.get import get_auths_internal
from app.v5.api.resources.auths.search import search_auths_internal
from app.v5.api.resources.colors.get import get_colors_internal
from app.v5.api.resources.colors.search import search_colors_internal
from app.v5.api.resources.departments.get import get_departments_internal
from app.v5.api.resources.departments.search import search_departments_internal
from app.v5.api.resources.descriptions.get import get_descriptions_internal
from app.v5.api.resources.descriptions.search import search_descriptions_internal
from app.v5.api.resources.flags.get import get_flags_internal
from app.v5.api.resources.flags.search import search_flags_internal
from app.v5.api.resources.models.get import get_models_internal
from app.v5.api.resources.names.get import get_names_internal
from app.v5.api.resources.names.search import search_names_internal
from app.v5.api.resources.profiles.get import get_profiles_internal
from app.v5.api.resources.profiles.search import search_profiles_internal
from app.v5.api.resources.provider_keys.get import get_provider_keys_internal
from app.v5.api.resources.provider_keys.search import search_provider_keys_internal
from app.v5.api.resources.providers.get import get_providers_internal
from app.v5.api.resources.roles.get import get_roles_internal
from app.v5.api.resources.roles.search import search_roles_internal
from app.v5.api.resources.tools.get import get_tools_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.v5.sql.types import (
    GetSettingAccessSqlParams,
    GetSettingAccessSqlRow,
    GetSettingIdsSqlParams,
    GetSettingIdsSqlRow,
    load_sql_query,
)
from app.v5.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/v5/sql/queries/settings/get_setting_access_complete.sql"
QUERY2_SQL_PATH = "app/v5/sql/queries/settings/get_setting_ids_complete.sql"

# Setting-specific flag names (business logic)
SETTING_FLAG_NAMES = {"setting_active"}

router = APIRouter()


async def get_setting_internal(
    profile_id: UUID,
    setting_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
    # Search/filter kwargs (threaded from websocket artifact tool)
    color_search: str | None = None,
) -> SettingInternalData:
    """Core data fetching layer (cacheable).

    Fetches all setting data using two-pass architecture and returns
    a dataclass with all computed values. This is the shared layer used by:
    - get_setting_websocket() - minimal data for WebSocket handlers
    - get_setting_client() - full BFF response for HTTP/frontend
    """

    # === POOL + PROFILE CONTEXT ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

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

    # Optionally fetch draft item
    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_setting_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    # === QUERY 1: Access Check ===
    async with pool.acquire() as conn:
        query1_params = GetSettingAccessSqlParams(
            profile_id=profile_id,
            setting_id=setting_id,
            draft_id=draft_id,
            draft_group_id=group_id
            or (draft_item.group_id if draft_item is not None else None),
            draft_version=draft_item.version if draft_item is not None else None,
        )

        access_result = cast(
            GetSettingAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        setting_department_ids = access_result.setting_department_ids or []

        if setting_id is not None:
            if access_result.setting_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Setting {setting_id} not found",
                )
            if not has_access(user_role, user_department_ids, setting_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this setting. It may be restricted to other departments.",
                )

        # Use provided group_id, or fall back to SQL-created one
        effective_group_id = group_id or access_result.group_id
        effective_draft_version = access_result.effective_draft_version

        # === QUERY 2: ID Fetching ===
        query2_params = GetSettingIdsSqlParams(
            profile_id=profile_id,
            setting_id=setting_id,
            draft_id=draft_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetSettingIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # Extract merged IDs from Q2 (draft overrides already applied in SQL)
    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id

    selected_color_ids = ids_result.color_ids or []
    selected_department_ids = ids_result.department_ids or []
    selected_profile_ids = ids_result.profile_ids or []
    selected_auth_ids = ids_result.auth_ids or []
    selected_provider_key_ids = ids_result.provider_key_ids or []
    selected_auth_item_key_ids = ids_result.auth_item_key_ids or []

    # Config chain resource IDs from settings agents
    config_agent_resource_ids = [a.id for a in settings_data.settings_agents if a.id]
    config_model_resource_ids = [
        a.model_id for a in settings_data.settings_agents if a.model_id
    ]
    # Provider IDs derived from models after fetch (sequential, not in gather)

    # === RESOLVE AGENTS FROM SETTINGS ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, SETTING_RESOURCES
    )

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    show_ai_generate_map = {
        resource: compute_show_ai_generate(agent_ids, resource)
        for resource in SETTING_RESOURCES
    }

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        user_department_ids=user_department_ids,
        setting_department_ids=setting_department_ids,
    )
    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        user_department_ids=user_department_ids,
        setting_department_ids=setting_department_ids,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []

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
                setting=True,
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
                setting=True,
            )
            return (selected, suggestions)

    async def fetch_colors():
        async with pool.acquire() as c:
            selected = await get_colors_internal(c, selected_color_ids, bypass_cache)
            suggestions = await search_colors_internal(
                c,
                color_search,
                20,
                0,
                effective_group_id,
                "recent",
                selected_color_ids,
                bypass_cache,
                setting=True,
            )
            return (selected, suggestions)

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache=bypass_cache,
                setting=True,
            )
            suggestions = [f for f in all_flags if f.name in SETTING_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(
                c, selected_department_ids, bypass_cache
            )
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=selected_department_ids,
                bypass_cache=bypass_cache,
                setting=True,
            )
            return (selected, suggestions)

    async def fetch_profiles():
        async with pool.acquire() as c:
            selected = await get_profiles_internal(
                c, selected_profile_ids, bypass_cache
            )
            suggestions = await search_profiles_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                exclude_ids=selected_profile_ids,
                bypass_cache=bypass_cache,
                setting=True,
            )
            return (selected, suggestions)

    async def fetch_auths():
        async with pool.acquire() as c:
            selected = await get_auths_internal(c, selected_auth_ids, bypass_cache)
            suggestions = await search_auths_internal(
                c,
                None,
                20,
                0,
                selected_auth_ids,
                bypass_cache=bypass_cache,
                setting=True,
            )
            return (selected, suggestions)

    async def fetch_provider_keys():
        async with pool.acquire() as c:
            selected = await get_provider_keys_internal(
                c, selected_provider_key_ids, bypass_cache
            )
            suggestions = await search_provider_keys_internal(
                c,
                None,
                20,
                0,
                selected_provider_key_ids,
                bypass_cache=bypass_cache,
                setting=True,
            )
            return (selected, suggestions)

    async def fetch_auth_item_keys():
        async with pool.acquire() as c:
            selected = await get_auth_item_keys_internal(
                c, selected_auth_item_key_ids, bypass_cache
            )
            suggestions = await search_auth_item_keys_internal(
                c,
                None,
                20,
                0,
                selected_auth_item_key_ids,
                bypass_cache=bypass_cache,
                setting=True,
            )
            return (selected, suggestions)

    async def fetch_roles():
        async with pool.acquire() as c:
            all_roles = await get_roles_internal(c, bypass_cache=bypass_cache)
            suggestions = await search_roles_internal(
                c,
                None,
                50,
                0,
                None,
                bypass_cache,
                setting=True,
            )
            return (all_roles, suggestions)

    async def fetch_config_agents():
        async with pool.acquire() as c:
            return await get_agents_internal(c, config_agent_resource_ids, bypass_cache)

    async def fetch_config_models():
        async with pool.acquire() as c:
            return await get_models_internal(c, config_model_resource_ids, bypass_cache)

    # === PARALLEL FETCH ===
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (colors_selected, colors_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (profiles_selected, profiles_suggestions),
        (auths_selected, auths_suggestions),
        (provider_keys_selected, provider_keys_suggestions),
        (auth_item_keys_selected, auth_item_keys_suggestions),
        (roles_all, roles_suggestions),
        config_agents_result,
        config_models_result,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_colors(),
        fetch_flags(),
        fetch_departments(),
        fetch_profiles(),
        fetch_auths(),
        fetch_provider_keys(),
        fetch_auth_item_keys(),
        fetch_roles(),
        fetch_config_agents(),
        fetch_config_models(),
    )

    # Derive providers from fetched models (must be sequential)
    config_provider_ids = list(
        dict.fromkeys(
            m.provider_id for m in (config_models_result or []) if m.provider_id
        )
    )
    config_providers_result: list[Any] = []
    if config_provider_ids:
        async with pool.acquire() as c:
            config_providers_result = await get_providers_internal(
                c, config_provider_ids, bypass_cache
            )

    # Dedupe selected + suggestions
    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    colors = _dedupe_by_id(colors_selected + colors_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    profiles = _dedupe_by_id(profiles_selected + profiles_suggestions, "profile_id")
    auths = _dedupe_by_id(auths_selected + auths_suggestions, "id")
    provider_keys = _dedupe_by_id(
        provider_keys_selected + provider_keys_suggestions, "id"
    )
    auth_item_keys = _dedupe_by_id(
        auth_item_keys_selected + auth_item_keys_suggestions, "id"
    )
    # Roles: get_roles_internal returns all, so just use suggestions for consistency
    roles = _dedupe_by_id(roles_suggestions, "role") if roles_suggestions else roles_all

    # Find selected resources (single-select)
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id), None
    )
    flag_resource_raw = next(
        (f for f in flags if f.id == selected_active_flag_id), None
    )

    # Find selected resources (multi-select)
    color_id_set = set(selected_color_ids)
    department_id_set = set(selected_department_ids)
    profile_id_set = set(selected_profile_ids)
    auth_id_set = set(selected_auth_ids)
    pk_id_set = set(selected_provider_key_ids)
    aik_id_set = set(selected_auth_item_key_ids)

    color_resources = [c for c in colors if c.id in color_id_set]
    department_resources = [
        d for d in departments if d.department_id in department_id_set
    ]
    profile_resources = [p for p in profiles if p.profile_id in profile_id_set]
    auth_resources = [a for a in auths if a.id in auth_id_set]
    provider_key_resources = [pk for pk in provider_keys if pk.id in pk_id_set]
    auth_item_key_resources = [aik for aik in auth_item_keys if aik.id in aik_id_set]
    # Roles: no id field on QGetRolesV4Item, return all as current
    role_resources = roles_all

    # Build suggestion ID lists
    name_suggestions_ids = [n.id for n in names_suggestions]
    description_suggestions_ids = [d.id for d in descriptions_suggestions]
    color_suggestions_ids = [c.id for c in colors_suggestions]
    department_suggestions_ids = [d.department_id for d in departments_suggestions]
    profile_suggestions_ids = [p.profile_id for p in profiles_suggestions]
    auth_suggestions_ids = [a.id for a in auths_suggestions]
    pk_suggestions_ids = [pk.id for pk in provider_keys_suggestions]
    aik_suggestions_ids = [aik.id for aik in auth_item_keys_suggestions]
    role_suggestions_ids: list[UUID] = []  # Roles don't use UUID suggestions

    # Compute show flags
    show_name = compute_show_name()
    show_description = compute_show_description()
    show_colors = compute_show_colors(len(colors))
    show_flag = compute_show_flag()
    flag_resource = (
        SettingFlagConfig(
            key=derive_flag_key_and_label(flag_resource_raw.name)[0],
            label=derive_flag_key_and_label(flag_resource_raw.name)[1],
            description=flag_resource_raw.description,
            icon_id=flag_resource_raw.icon,
            flag_option_id=flag_resource_raw.id,
            show=show_flag,
            required=compute_flag_required(),
            generated=flag_resource_raw.generated,
        )
        if flag_resource_raw
        else None
    )
    show_departments = compute_show_departments(len(departments))
    show_profiles = compute_show_profiles()
    show_auths = compute_show_auths()
    show_provider_keys = compute_show_provider_keys()
    show_auth_item_keys = compute_show_auth_item_keys()
    show_roles = compute_show_roles()

    show_map = {
        "names": show_name,
        "descriptions": show_description,
        "colors": show_colors,
        "flags": show_flag,
        "departments": show_departments,
        "profiles": show_profiles,
        "auths": show_auths,
        "provider_keys": show_provider_keys,
        "auth_item_keys": show_auth_item_keys,
        "roles": show_roles,
    }

    required_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "colors": compute_colors_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(show_departments),
        "profiles": compute_profiles_required(),
        "auths": compute_auths_required(),
        "provider_keys": compute_provider_keys_required(),
        "auth_item_keys": compute_auth_item_keys_required(),
        "roles": compute_roles_required(),
    }

    suggestions_map: dict[str, list[UUID]] = {
        "names": [x for x in name_suggestions_ids if x],
        "descriptions": [x for x in description_suggestions_ids if x],
        "colors": [x for x in color_suggestions_ids if x],
        "departments": [x for x in department_suggestions_ids if x],
        "profiles": [x for x in profile_suggestions_ids if x],
        "auths": [x for x in auth_suggestions_ids if x],
        "provider_keys": [x for x in pk_suggestions_ids if x],
        "auth_item_keys": [x for x in aik_suggestions_ids if x],
        "roles": role_suggestions_ids,
    }

    # Transform flags to enriched format for client
    setting_flags = [
        SettingFlagConfig(
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
    if setting_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Build resources payload
    resources_payload = SettingResources(
        resources=SettingResourceBucket(
            names=names,
            descriptions=descriptions,
            colors=colors,
            flags=setting_flags,
            departments=departments,
            profiles=profiles,
            auths=auths,
            provider_keys=provider_keys,
            auth_item_keys=auth_item_keys,
            roles=roles,
        ),
        current=SettingResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            colors=color_resources or [],
            flags=[flag_resource] if flag_resource else [],
            departments=department_resources or [],
            profiles=profile_resources or [],
            auths=auth_resources or [],
            provider_keys=provider_key_resources or [],
            auth_item_keys=auth_item_key_resources or [],
            roles=role_resources or [],
        ),
    )

    return SettingInternalData(
        actor_name=actor_name,
        setting_exists=access_result.setting_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        resource_agent_ids=agent_ids,
        show_map=show_map,
        required_map=required_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        resources_payload=resources_payload,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        config_agent_resources=config_agents_result or None,
        config_model_resources=config_models_result or None,
        config_provider_resources=config_providers_result or None,
    )


async def get_setting_websocket(
    profile_id: UUID,
    setting_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    # Search/filter kwargs (from artifact tool calls)
    color_search: str | None = None,
) -> GetSettingWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Wraps get_setting_internal() for shared resource fetching (Q1, Q2, Pass 2),
    then reshapes into views + resources format. Additionally:
    - Fetches draft setting view (convenience for Jinja templates, NOT source of truth)
    - Hydrates tools from config agent's tool_ids
    """
    data = await get_setting_internal(
        profile_id=profile_id,
        setting_id=setting_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        color_search=color_search,
    )

    # Fetch draft setting view, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_setting_drafts_entries_internal(
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
        agent_resource = data.config_agent_resources[0]
        if not agent_resource or not agent_resource.tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools_internal(
                c, list(agent_resource.tool_ids), bypass_cache
            )

    (
        draft_setting,
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

    # Extract current (selected) resources from internal data
    current = data.resources_payload.current

    # Get enriched flags for the selected flag(s)
    selected_flag_ids = set()
    if current and current.flags:
        for f in current.flags:
            fid = getattr(f, "flag_option_id", None) or getattr(f, "id", None)
            if fid:
                selected_flag_ids.add(fid)
    all_enriched_flags = (
        data.resources_payload.resources.flags
        if data.resources_payload.resources
        else []
    ) or []
    selected_enriched_flags = [
        f for f in all_enriched_flags if f.flag_option_id in selected_flag_ids
    ]

    # Build entries (always construct — both fields optional now)
    entries = SettingWebsocketEntries(
        draft_setting=draft_setting,
        runs=runs_result,
    )

    return GetSettingWebsocketResponse(
        entries=entries if draft_setting or runs_result else None,
        resources=SettingWebsocketResources(
            names=current.names if current else None,
            descriptions=current.descriptions if current else None,
            colors=current.colors if current else None,
            flags=selected_enriched_flags or None,
            departments=current.departments if current else None,
            profiles=current.profiles if current else None,
            auths=current.auths if current else None,
            provider_keys=current.provider_keys if current else None,
            auth_item_keys=current.auth_item_keys if current else None,
            roles=current.roles if current else None,
        ),
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetSettingApiRequest(
            setting_id=setting_id,
            draft_id=draft_id,
            color_search=color_search,
        ),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def get_setting_client(
    profile_id: UUID,
    setting_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetSettingApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed show_ai_generate flags.
    """
    data = await get_setting_internal(
        profile_id=profile_id,
        setting_id=setting_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        group_id=group_id,
    )

    all_resources = data.resources_payload.resources
    current = data.resources_payload.current

    def _section_common(resource_key: str) -> dict:
        return {
            "show": data.show_map.get(resource_key, False),
            "required": data.required_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "create_tool_id": data.create_tool_ids_map.get(resource_key),
            "link_tool_id": data.link_tool_ids_map.get(resource_key),
        }

    return GetSettingApiResponse(
        actor_name=data.actor_name,
        setting_exists=data.setting_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        resource_agent_ids=data.resource_agent_ids,
        # Single-select sections
        names=SettingNameSection(
            **_section_common("names"),
            resource=(current.names[0] if current and current.names else None),
            resources=all_resources.names if all_resources else [],
        ),
        descriptions=SettingDescriptionSection(
            **_section_common("descriptions"),
            resource=(
                current.descriptions[0] if current and current.descriptions else None
            ),
            resources=all_resources.descriptions if all_resources else [],
        ),
        # Flag section
        flags=SettingFlagSection(
            **_section_common("flags"),
            current=(current.flags[0] if current and current.flags else None),
            resources=all_resources.flags if all_resources else [],
        ),
        # Multi-select sections
        colors=SettingColorSection(
            **_section_common("colors"),
            current=current.colors if current else [],
            resources=all_resources.colors if all_resources else [],
        ),
        departments=SettingDepartmentSection(
            **_section_common("departments"),
            current=current.departments if current else [],
            resources=all_resources.departments if all_resources else [],
        ),
        profiles=SettingProfileSection(
            **_section_common("profiles"),
            current=current.profiles if current else [],
            resources=all_resources.profiles if all_resources else [],
        ),
        auths=SettingAuthSection(
            **_section_common("auths"),
            current=current.auths if current else [],
            resources=all_resources.auths if all_resources else [],
        ),
        provider_keys=SettingProviderKeySection(
            **_section_common("provider_keys"),
            current=current.provider_keys if current else [],
            resources=all_resources.provider_keys if all_resources else [],
        ),
        auth_item_keys=SettingAuthItemKeySection(
            **_section_common("auth_item_keys"),
            current=current.auth_item_keys if current else [],
            resources=all_resources.auth_item_keys if all_resources else [],
        ),
        roles=SettingRoleSection(
            **_section_common("roles"),
            current=current.roles if current else [],
            resources=all_resources.roles if all_resources else [],
        ),
    )


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


@router.post("/get", response_model=GetSettingApiResponse)
async def get_setting(
    request: GetSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSettingApiResponse:
    """Get setting information using two-pass architecture.

    This is a thin HTTP wrapper around get_setting_client().

    Query 1: Access check (user role, departments, setting state)
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

        response_data = await get_setting_client(
            profile_id=profile_id,
            setting_id=request.setting_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            group_id=request.group_id,
        )

        response.headers["X-Cache-Tags"] = "settings"
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
            operation="get_setting",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

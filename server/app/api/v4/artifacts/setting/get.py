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

from app.api.v4.artifacts.setting.permissions import (
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
    compute_role_routes_required,
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
    compute_show_role_routes,
    compute_show_roles,
    derive_flag_key_and_label,
    has_access,
)
from app.api.v4.artifacts.setting.types import (
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
    SettingRoleRouteSection,
    SettingRoleSection,
    SettingWebsocketResources,
    SettingWebsocketViews,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.auth_item_keys.get import get_auth_item_keys_internal
from app.api.v4.resources.auth_item_keys.search import search_auth_item_keys_internal
from app.api.v4.resources.auths.get import get_auths_internal
from app.api.v4.resources.auths.search import search_auths_internal
from app.api.v4.resources.colors.get import get_colors_internal
from app.api.v4.resources.colors.search import search_colors_internal
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
from app.api.v4.resources.profiles.search import search_profiles_internal
from app.api.v4.resources.provider_keys.get import get_provider_keys_internal
from app.api.v4.resources.provider_keys.search import search_provider_keys_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.role_routes.get import get_role_routes_internal
from app.api.v4.resources.role_routes.search import search_role_routes_internal
from app.api.v4.resources.roles.get import get_roles_internal
from app.api.v4.resources.roles.search import search_roles_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_setting_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetSettingAccessSqlParams,
    GetSettingAccessSqlRow,
    GetSettingIdsSqlParams,
    GetSettingIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/settings/get_setting_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/settings/get_setting_ids_complete.sql"

# Setting-specific flag names (business logic)
SETTING_FLAG_NAMES = {"setting_active"}

router = APIRouter()


async def get_setting_internal(
    profile_id: UUID,
    setting_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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
            draft_items = await get_draft_setting_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
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
            draft_group_id=draft_item.group_id if draft_item is not None else None,
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

        # group_id is guaranteed by SQL (created inline if no draft)
        effective_group_id = access_result.group_id
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
    selected_role_route_ids = ids_result.role_route_ids or []

    # Config chain resource IDs
    config_agent_resource_ids = ids_result.config_agent_resource_ids or []
    config_model_resource_ids = ids_result.config_model_resource_ids or []
    config_provider_resource_ids = ids_result.config_provider_resource_ids or []

    # === PARSE CANDIDATE AGENTS + COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(SETTING_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=SETTING_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in SETTING_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if selected_agent_id:
            for candidate in candidate_agents:
                if candidate.agent_id == selected_agent_id:
                    create_tool_ids_map[resource] = candidate.create_tool_ids.get(
                        resource
                    )
                    link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                    break

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
                None,
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

    async def fetch_role_routes():
        async with pool.acquire() as c:
            selected = await get_role_routes_internal(
                c, selected_role_route_ids, bypass_cache
            )
            suggestions = await search_role_routes_internal(
                c,
                None,
                50,
                0,
                selected_role_route_ids,
                bypass_cache=bypass_cache,
                setting=True,
            )
            return (selected, suggestions)

    async def fetch_config_agents():
        async with pool.acquire() as c:
            return await get_agents_internal(c, config_agent_resource_ids, bypass_cache)

    async def fetch_config_models():
        async with pool.acquire() as c:
            return await get_models_internal(c, config_model_resource_ids, bypass_cache)

    async def fetch_config_providers():
        async with pool.acquire() as c:
            return await get_providers_internal(
                c, config_provider_resource_ids, bypass_cache
            )

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
        (role_routes_selected, role_routes_suggestions),
        config_agents_result,
        config_models_result,
        config_providers_result,
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
        fetch_role_routes(),
        fetch_config_agents(),
        fetch_config_models(),
        fetch_config_providers(),
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
    role_routes = _dedupe_by_id(role_routes_selected + role_routes_suggestions, "id")

    # Find selected resources (single-select)
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id), None
    )
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)

    # Find selected resources (multi-select)
    color_id_set = set(selected_color_ids)
    department_id_set = set(selected_department_ids)
    profile_id_set = set(selected_profile_ids)
    auth_id_set = set(selected_auth_ids)
    pk_id_set = set(selected_provider_key_ids)
    aik_id_set = set(selected_auth_item_key_ids)
    rr_id_set = set(selected_role_route_ids)

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
    role_route_resources = [rr for rr in role_routes if rr.id in rr_id_set]

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
    rr_suggestions_ids = [rr.id for rr in role_routes_suggestions]

    # Compute show flags
    show_name = compute_show_name()
    show_description = compute_show_description()
    show_colors = compute_show_colors(len(colors))
    show_flag = compute_show_flag()
    show_departments = compute_show_departments(len(departments))
    show_profiles = compute_show_profiles()
    show_auths = compute_show_auths()
    show_provider_keys = compute_show_provider_keys()
    show_auth_item_keys = compute_show_auth_item_keys()
    show_roles = compute_show_roles()
    show_role_routes = compute_show_role_routes()

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
        "role_routes": show_role_routes,
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
        "role_routes": compute_role_routes_required(),
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
        "role_routes": [x for x in rr_suggestions_ids if x],
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
            role_routes=role_routes,
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
            role_routes=role_route_resources or [],
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
    )

    # Fetch draft setting view for Jinja template convenience
    draft_setting = None
    if draft_id:
        pool = get_pool()
        if pool:
            async with pool.acquire() as conn:
                draft_items = await get_draft_setting_internal(
                    conn=conn,
                    draft_ids=[draft_id],
                    bypass_cache=bypass_cache,
                )
                if draft_items:
                    draft_setting = draft_items[0]

    # Hydrate tools from config agent's tool_ids
    tools_result: list = []
    if data.config_agent_resources:
        agent_resource = data.config_agent_resources[0]
        if agent_resource and agent_resource.tool_ids:
            pool = get_pool()
            if pool:
                async with pool.acquire() as c:
                    tools_result = await get_tools_internal(
                        c, list(agent_resource.tool_ids), bypass_cache
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

    return GetSettingWebsocketResponse(
        views=SettingWebsocketViews(draft_setting=draft_setting)
        if draft_setting
        else None,
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
            role_routes=current.role_routes if current else None,
            agents=data.config_agent_resources,
            models=data.config_model_resources,
            providers=data.config_provider_resources,
            tools=tools_result or None,
        ),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def get_setting_client(
    profile_id: UUID,
    setting_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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
        role_routes=SettingRoleRouteSection(
            **_section_common("role_routes"),
            current=current.role_routes if current else [],
            resources=all_resources.role_routes if all_resources else [],
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


@router.post(
    "/get",
    response_model=GetSettingApiResponse,
    dependencies=[
        audit_activity(
            "setting.get",
            "{{ actor.name }} {% if setting %}viewed{% else %}opened new{% endif %} setting{% if setting %} '{{ setting.name }}'{% endif %}",
        )
    ],
)
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
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = None
            if response_data.names and response_data.names.resource:
                current_name = getattr(response_data.names.resource, "name", None)
            if request.setting_id and current_name:
                audit_ctx["setting"] = {
                    "name": current_name,
                    "id": str(request.setting_id),
                }
            audit_set(http_request, **audit_ctx)

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

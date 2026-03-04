"""Profile get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_profile_internal() - Core data fetching (cacheable, returns dataclass)
2. get_profile_websocket() - Minimal data for WebSocket handlers
3. get_profile_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool, get_redis_client
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.profile.permissions import (
    PROFILE_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_disabled_reason,
    compute_emails_required,
    compute_flag_required,
    compute_name_required,
    compute_request_limit_required,
    compute_show_departments,
    compute_show_emails,
    compute_show_flag,
    compute_show_name,
    compute_show_request_limit,
    has_access,
)
from app.routes.v5.api.main.profile.types import (
    GetProfileApiRequest,
    GetProfileApiResponse,
    GetProfileWebsocketResponse,
    ProfileDepartmentSection,
    ProfileEmailSection,
    ProfileFlagConfig,
    ProfileFlagSection,
    ProfileNameSection,
    ProfileRequestLimitSection,
    ProfileRoleResource,
    ProfileWebsocketEntries,
    ProfileWebsocketResources,
)
from app.routes.v5.api.permissions import (
    has_tools_for_resource,
    resolve_agents_for_artifact,
)
from app.routes.v5.tools.entries.profile_drafts.get import (
    get_profile_drafts_entries_internal,
)
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.resources.agents.get import get_agents_internal
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.departments.search import search_departments_internal
from app.routes.v5.tools.resources.emails.get import get_emails
from app.routes.v5.tools.resources.emails.search import search_emails_internal
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags_internal
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names_internal
from app.routes.v5.tools.resources.profiles.get import get_profiles
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.request_limits.get import get_request_limits_internal
from app.routes.v5.tools.resources.request_limits.search import (
    search_request_limits_internal,
)
from app.routes.v5.tools.resources.tools.get import get_tools
from app.sql.types import (
    GetProfileAccessSqlParams,
    GetProfileAccessSqlRow,
    GetProfileIdsSqlParams,
    GetProfileIdsSqlRow,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/queries/profile/get_profile_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/profile/get_profile_ids_complete.sql"

router = APIRouter()


@dataclass
class ProfileInternalData:
    """Internal data from core profile fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_profile_websocket() - minimal data for WebSocket handlers
    - get_profile_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    profile_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None
    profile_id: UUID | None

    # Role
    role: str | None
    role_options: list[str]
    roles: list[ProfileRoleResource]

    # Agent mappings
    agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: agent exists for resource)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    general_show_ai_generate: bool
    # Selected resource objects
    selected_name_resource: Any | None
    selected_flag_resource: ProfileFlagConfig | None
    selected_request_limit_resource: Any | None
    selected_email_resources: list[Any]
    selected_department_resources: list[Any]
    # All resources (selected + suggestions)
    all_name_resources: list[Any]
    all_email_resources: list[Any]
    all_request_limit_resources: list[Any]
    all_flag_resources: list[ProfileFlagConfig]
    all_department_resources: list[Any]
    # Config resources (selected agents -> models/providers/tools)
    config_agent_resources: list[Any] | None
    config_model_resources: list[Any] | None
    config_provider_resources: list[Any] | None
    config_tool_resources: list[Any] | None

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_profile_internal(
    profile_id: UUID,
    target_profile_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> ProfileInternalData:
    """Core data fetching layer (cacheable).

    Fetches all profile data using two-pass architecture and returns
    a dataclass with all computed values.
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_profile_drafts_entries_internal(
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
        query1_params = GetProfileAccessSqlParams(
            profile_id=profile_id,
            target_profile_id=target_profile_id,
            draft_id=draft_id,
            draft_group_id=draft_item.group_id if draft_item is not None else None,
            draft_version=draft_item.version if draft_item is not None else None,
        )

        access_result = cast(
            GetProfileAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        target_department_ids = access_result.target_department_ids or []
        target_is_self = access_result.target_is_self or False
        resolved_target_id = access_result.resolved_target_profile_id

        # Early validation: check profile exists
        if target_profile_id is not None:
            if access_result.profile_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile {target_profile_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, target_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this profile. It may be restricted to other departments.",
                )

        # group_id is guaranteed by SQL (created inline if no draft)
        if group_id:
            effective_group_id = group_id
        else:
            effective_group_id = access_result.group_id
        effective_draft_version = access_result.draft_version

        # Parse roles from access result
        roles: list[ProfileRoleResource] = []
        if access_result.roles:
            for r in access_result.roles:
                roles.append(
                    ProfileRoleResource(
                        role=r.role,
                        name=r.name,
                        description=r.description,
                        icon_value=r.icon_value,
                        color_hex=r.color_hex,
                    )
                )

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetProfileIdsSqlParams(
            profile_id=profile_id,
            target_profile_id=target_profile_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetProfileIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_request_limit_id = ids_result.request_limit_id
    selected_active_flag_id = ids_result.active_flag_id

    selected_email_ids = ids_result.email_ids or []
    selected_department_ids = ids_result.department_ids or []

    selected_role = ids_result.role

    # Draft values override canonical profile-junction values.
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, PROFILE_RESOURCES
    )

    # Derive has_tools flags from settings
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")
    emails_has_tools = has_tools_for_resource(
        settings_data.agent_tool_entries, "emails"
    )
    request_limits_has_tools = has_tools_for_resource(
        settings_data.agent_tool_entries, "request_limits"
    )

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        return agent_ids.get(resource) is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    emails_show_ai_generate = compute_show_ai_generate("emails")
    request_limits_show_ai_generate = compute_show_ai_generate("request_limits")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")

    # Step-level show_ai_generate flags
    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            emails_show_ai_generate,
            flag_show_ai_generate,
            request_limits_show_ai_generate,
        ]
    )
    general_show_ai_generate = any(
        [
            name_show_ai_generate,
            emails_show_ai_generate,
            request_limits_show_ai_generate,
            flag_show_ai_generate,
            departments_show_ai_generate,
        ]
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        target_is_self=target_is_self,
        target_department_ids=target_department_ids,
        user_department_ids=user_department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        target_is_self=target_is_self,
        target_department_ids=target_department_ids,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [selected_name_id] if selected_name_id else []
    request_limit_ids = [selected_request_limit_id] if selected_request_limit_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    email_ids = selected_email_ids
    department_ids = selected_department_ids

    PROFILE_FLAG_NAMES = {"profile_active"}

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names(
                c, name_ids, get_redis_client(), bypass_cache=bypass_cache
            )
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                None,
                name_ids,
                bypass_cache,
                profile=True,
            )
            return (selected, suggestions)

    async def fetch_emails():
        async with pool.acquire() as c:
            selected = await get_emails(c, email_ids, get_redis_client(), cache)
            suggestions = await search_emails_internal(
                c,
                None,
                20,
                0,
                email_ids,
                bypass_cache,
                profile=True,
            )
            return (selected, suggestions)

    async def fetch_request_limits():
        async with pool.acquire() as c:
            selected = await get_request_limits_internal(
                c, request_limit_ids, bypass_cache
            )
            suggestions = await search_request_limits_internal(
                c,
                None,
                20,
                0,
                request_limit_ids,
                bypass_cache,
                profile=True,
            )
            return (selected, suggestions)

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags(c, flag_ids, get_redis_client(), bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                cache=cache,
                profile=True,
            )
            # Filter to only profile-specific flags
            suggestions = [f for f in all_flags if f.name in PROFILE_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments(c, department_ids, get_redis_client(), bypass_cache=bypass_cache)
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=department_ids,
                bypass_cache=bypass_cache,
                profile=True,
            )
            return (selected, suggestions)

    async def fetch_generation_config():
        config_agent_ids = [a.id for a in settings_data.settings_agents if a.id]
        config_model_ids = [
            a.model_id for a in settings_data.settings_agents if a.model_id
        ]
        if not config_agent_ids:
            return (None, None, None, None)

        async with pool.acquire() as c:
            agents = await get_agents_internal(c, config_agent_ids, bypass_cache)
            models = (
                await get_models(c, config_model_ids, get_redis_client(), bypass_cache)
                if config_model_ids
                else []
            )
            provider_ids = list(
                {
                    m.provider_id
                    for m in models
                    if getattr(m, "provider_id", None) is not None
                }
            )
            providers = (
                await get_providers(c, provider_ids, get_redis_client(), bypass_cache=bypass_cache)
                if provider_ids
                else []
            )
            tool_ids = list(
                {tid for a in agents for tid in (a.tool_ids or []) if tid is not None}
            )
            tools = (
                await get_tools(
                    c, tool_ids, get_redis_client(), bypass_cache=bypass_cache
                )
                if tool_ids
                else []
            )
            return (agents or None, models or None, providers or None, tools or None)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (emails_selected, emails_suggestions),
        (request_limits_selected, request_limits_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (
            config_agent_resources,
            config_model_resources,
            config_provider_resources,
            config_tool_resources,
        ),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_emails(),
        fetch_request_limits(),
        fetch_flags(),
        fetch_departments(),
        fetch_generation_config(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    emails = _dedupe_by_id(emails_selected + emails_suggestions, "id")
    request_limits = _dedupe_by_id(
        request_limits_selected + request_limits_suggestions, "id"
    )
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )

    # Compute final show flags based on actual data
    show_name = compute_show_name(names_has_tools)
    show_emails_flag = compute_show_emails(emails_has_tools)
    show_request_limit = compute_show_request_limit(request_limits_has_tools)
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))

    # Build show and required flags maps
    show_flags_map = {
        "names": show_name,
        "emails": show_emails_flag,
        "request_limits": show_request_limit,
        "flags": show_flag,
        "departments": show_departments_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "emails": compute_emails_required(),
        "request_limits": compute_request_limit_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
    }

    # Transform flags to enriched format for client
    profile_flags = [
        ProfileFlagConfig(
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

    # Build suggestion ID lists
    name_suggestions = [n.id for n in names_suggestions]
    email_suggestions = [e.id for e in emails_suggestions]
    request_limit_suggestions = [r.id for r in request_limits_suggestions]
    department_suggestions = [d.department_id for d in departments_suggestions]

    # Build show_ai_generate map
    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "emails": emails_show_ai_generate,
        "request_limits": request_limits_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions,
        "emails": email_suggestions,
        "request_limits": request_limit_suggestions,
        "departments": department_suggestions,
    }

    # === Construct Resources Payload ===
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    email_resources = [e for e in emails if e.id in selected_email_ids]
    request_limit_resource = next(
        (r for r in request_limits if r.id == selected_request_limit_id), None
    )
    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]

    selected_flag_resource = (
        next(
            (f for f in profile_flags if f.flag_option_id == selected_active_flag_id),
            None,
        )
        if selected_active_flag_id
        else None
    )

    return ProfileInternalData(
        # Access/context
        actor_name=actor_name,
        profile_exists=access_result.profile_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        profile_id=resolved_target_id,
        # Role
        role=selected_role,
        role_options=access_result.role_options or [],
        roles=roles,
        agent_ids=agent_ids,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        general_show_ai_generate=general_show_ai_generate,
        selected_name_resource=name_resource,
        selected_flag_resource=selected_flag_resource,
        selected_request_limit_resource=request_limit_resource,
        selected_email_resources=email_resources,
        selected_department_resources=department_resources,
        all_name_resources=names,
        all_email_resources=emails,
        all_request_limit_resources=request_limits,
        all_flag_resources=profile_flags,
        all_department_resources=departments,
        # Config resources
        config_agent_resources=config_agent_resources,
        config_model_resources=config_model_resources,
        config_provider_resources=config_provider_resources,
        config_tool_resources=config_tool_resources,
        # Per-resource tool IDs
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_profile_websocket(
    profile_id: UUID,
    target_profile_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetProfileWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns only what's needed for AI generation:
    - group_id
    - draft view for template convenience
    - selected resources
    - resource_type -> agent_id mapping
    """
    data = await get_profile_internal(
        profile_id=profile_id,
        target_profile_id=target_profile_id,
        draft_id=draft_id,
        cache=cache,
    )

    # Fetch draft, config_profile, and runs_today in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_profile_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            return draft_items[0] if draft_items else None

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await get_profiles(conn, [profile_id], get_redis_client(), cache)

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

    (
        draft_profile,
        config_profile_result,
        runs_result,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
    )

    # Enrich tools with args and args_outputs
    config_tools = data.config_tool_resources or []
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
                    return await get_args(
                        c,
                        list(set(all_args_ids)),
                        get_redis_client(),
                        bypass_cache=bypass_cache,
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c,
                        list(set(all_args_output_ids)),
                        get_redis_client(),
                        bypass_cache=bypass_cache,
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    # Build entries (always construct — both fields optional now)
    entries = ProfileWebsocketEntries(
        draft_profile=draft_profile,
        runs=runs_result,
    )

    return GetProfileWebsocketResponse(
        group_id=data.group_id,
        entries=entries if draft_profile or runs_result else None,
        resources=ProfileWebsocketResources(
            names=[data.selected_name_resource] if data.selected_name_resource else [],
            emails=data.selected_email_resources,
            request_limits=[data.selected_request_limit_resource]
            if data.selected_request_limit_resource
            else [],
            flags=[data.selected_flag_resource] if data.selected_flag_resource else [],
            departments=data.selected_department_resources,
        ),
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=data.config_tool_resources,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetProfileApiRequest(
            target_profile_id=target_profile_id, draft_id=draft_id
        ),
        resource_agent_ids=data.agent_ids,
    )


async def get_profile_client(
    profile_id: UUID,
    target_profile_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetProfileApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags.
    """
    data = await get_profile_internal(
        profile_id=profile_id,
        target_profile_id=target_profile_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        group_id=group_id,
    )

    return GetProfileApiResponse(
        actor_name=data.actor_name,
        profile_exists=data.profile_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        profile_id=data.profile_id,
        role=data.role,
        role_options=data.role_options,
        roles=data.roles,
        basic_show_ai_generate=data.basic_show_ai_generate,
        general_show_ai_generate=data.general_show_ai_generate,
        names=ProfileNameSection(
            show=data.show_flags_map.get("names", False),
            required=data.required_flags_map.get("names", False),
            suggestions=data.suggestions_map.get("names"),
            show_ai_generate=data.show_ai_generate_map.get("names", False),
            create_tool_id=data.create_tool_ids_map.get("names"),
            link_tool_id=data.link_tool_ids_map.get("names"),
            resource=data.selected_name_resource,
            resources=data.all_name_resources,
        ),
        emails=ProfileEmailSection(
            show=data.show_flags_map.get("emails", False),
            required=data.required_flags_map.get("emails", False),
            suggestions=data.suggestions_map.get("emails"),
            show_ai_generate=data.show_ai_generate_map.get("emails", False),
            create_tool_id=data.create_tool_ids_map.get("emails"),
            link_tool_id=data.link_tool_ids_map.get("emails"),
            current=data.selected_email_resources,
            resources=data.all_email_resources,
        ),
        request_limits=ProfileRequestLimitSection(
            show=data.show_flags_map.get("request_limits", False),
            required=data.required_flags_map.get("request_limits", False),
            suggestions=data.suggestions_map.get("request_limits"),
            show_ai_generate=data.show_ai_generate_map.get("request_limits", False),
            create_tool_id=data.create_tool_ids_map.get("request_limits"),
            link_tool_id=data.link_tool_ids_map.get("request_limits"),
            resource=data.selected_request_limit_resource,
            resources=data.all_request_limit_resources,
        ),
        flags=ProfileFlagSection(
            show=data.show_flags_map.get("flags", False),
            required=data.required_flags_map.get("flags", False),
            show_ai_generate=data.show_ai_generate_map.get("flags", False),
            create_tool_id=data.create_tool_ids_map.get("flags"),
            link_tool_id=data.link_tool_ids_map.get("flags"),
            current=data.selected_flag_resource,
            resources=data.all_flag_resources,
        ),
        departments=ProfileDepartmentSection(
            show=data.show_flags_map.get("departments", False),
            required=data.required_flags_map.get("departments", False),
            suggestions=data.suggestions_map.get("departments"),
            show_ai_generate=data.show_ai_generate_map.get("departments", False),
            create_tool_id=data.create_tool_ids_map.get("departments"),
            link_tool_id=data.link_tool_ids_map.get("departments"),
            current=data.selected_department_resources,
            resources=data.all_department_resources,
        ),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'profile_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("profile_", "")
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


@router.post("/get", response_model=GetProfileApiResponse)
async def get_profile(
    request: GetProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileApiResponse:
    """Get profile information using two-pass architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_profile_client(
            profile_id=profile_id,
            target_profile_id=request.target_profile_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            group_id=request.group_id,
        )

        response.headers["X-Cache-Tags"] = "profile"
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
            operation="get_profile",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )


from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

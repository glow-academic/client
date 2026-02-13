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

from app.api.v4.artifacts.profile.permissions import (
    PROFILE_RESOURCES,
    compute_can_edit,
    compute_cohorts_required,
    compute_departments_required,
    compute_disabled_reason,
    compute_emails_required,
    compute_flag_required,
    compute_name_required,
    compute_request_limit_required,
    compute_show_cohorts,
    compute_show_departments,
    compute_show_emails,
    compute_show_flag,
    compute_show_name,
    compute_show_request_limit,
    has_access,
)
from app.api.v4.artifacts.profile.types import (
    GetProfileApiRequest,
    GetProfileApiResponse,
    GetProfileWebsocketResponse,
    ProfileCohortSection,
    ProfileDepartmentSection,
    ProfileEmailSection,
    ProfileFlagConfig,
    ProfileFlagSection,
    ProfileNameSection,
    ProfileRequestLimitSection,
    ProfileRoleResource,
    ProfileWebsocketResources,
    ProfileWebsocketViews,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.cohorts.search import search_cohorts_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.emails.get import get_emails_internal
from app.api.v4.resources.emails.search import search_emails_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.request_limits.get import get_request_limits_internal
from app.api.v4.resources.request_limits.search import search_request_limits_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_profile_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetProfileAccessSqlParams,
    GetProfileAccessSqlRow,
    GetProfileIdsSqlParams,
    GetProfileIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/profile/get_profile_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/profile/get_profile_ids_complete.sql"

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
    selected_cohort_resources: list[Any]
    # All resources (selected + suggestions)
    all_name_resources: list[Any]
    all_email_resources: list[Any]
    all_request_limit_resources: list[Any]
    all_flag_resources: list[ProfileFlagConfig]
    all_department_resources: list[Any]
    all_cohort_resources: list[Any]
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
            draft_items = await get_draft_profile_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    # Fetch user context for permissions
    async with pool.acquire() as context_conn:
        resolved_context = await get_profile_context_internal(
            conn=context_conn,
            profile_id=profile_id,
            department_id_cookie=None,
            bypass_cache=bypass_cache,
        )
    user_role = resolved_context.user_role
    actor_name = resolved_context.actor_name
    user_department_ids = [
        d.department_id for d in resolved_context.departments if d.department_id
    ]

    async with pool.acquire() as conn:
        query1_params = GetProfileAccessSqlParams(
            profile_id=profile_id,
            target_profile_id=target_profile_id,
            draft_id=draft_id,
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

        effective_group_id = (
            draft_item.group_id
            if draft_item is not None and draft_item.group_id is not None
            else access_result.group_id
        )
        effective_draft_version = (
            draft_item.version
            if draft_item is not None
            else access_result.draft_version
        )

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
    selected_cohort_ids = ids_result.cohort_ids or []

    selected_role = ids_result.role

    # Draft values override canonical profile-junction values.
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids

    # Get tools existence flags from Query 2 (used for show_* UI flags)
    names_has_tools = ids_result.names_has_tools or False
    emails_has_tools = ids_result.emails_has_tools or False
    request_limits_has_tools = ids_result.request_limits_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(PROFILE_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=PROFILE_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in PROFILE_RESOURCES:
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
    def compute_show_ai_generate(resource: str) -> bool:
        return agent_ids.get(resource) is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    emails_show_ai_generate = compute_show_ai_generate("emails")
    request_limits_show_ai_generate = compute_show_ai_generate("request_limits")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")
    cohorts_show_ai_generate = compute_show_ai_generate("cohorts")

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
            cohorts_show_ai_generate,
        ]
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        target_is_self=target_is_self,
        target_department_ids=target_department_ids,
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
    cohort_ids = selected_cohort_ids

    PROFILE_FLAG_NAMES = {"profile_active"}

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
                profile=True,
            )
            return (selected, suggestions)

    async def fetch_emails():
        async with pool.acquire() as c:
            selected = await get_emails_internal(c, email_ids, bypass_cache)
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
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache,
                profile=True,
            )
            # Filter to only profile-specific flags
            suggestions = [f for f in all_flags if f.name in PROFILE_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
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
                profile=True,
            )
            return (selected, suggestions)

    async def fetch_cohorts():
        async with pool.acquire() as c:
            selected = await get_cohorts_internal(c, cohort_ids, bypass_cache)
            suggestions = await search_cohorts_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                exclude_ids=cohort_ids,
                bypass_cache=bypass_cache,
                profile=True,
            )
            return (selected, suggestions)

    async def fetch_generation_config():
        selected_agent_ids = list(
            {aid for aid in agent_ids.values() if aid is not None}
        )
        if not selected_agent_ids:
            return (None, None, None, None)

        async with pool.acquire() as c:
            agents = await get_agents_internal(c, selected_agent_ids, bypass_cache)
            model_ids = list(
                {a.model_id for a in agents if getattr(a, "model_id", None) is not None}
            )
            models = (
                await get_models_internal(c, model_ids, bypass_cache)
                if model_ids
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
                await get_providers_internal(c, provider_ids, bypass_cache)
                if provider_ids
                else []
            )
            tool_ids = list(
                {tid for a in agents for tid in (a.tool_ids or []) if tid is not None}
            )
            tools = (
                await get_tools_internal(c, tool_ids, bypass_cache) if tool_ids else []
            )
            return (agents or None, models or None, providers or None, tools or None)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (emails_selected, emails_suggestions),
        (request_limits_selected, request_limits_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (cohorts_selected, cohorts_suggestions),
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
        fetch_cohorts(),
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
    cohorts = _dedupe_by_id(cohorts_selected + cohorts_suggestions, "cohort_id")

    # Compute final show flags based on actual data
    show_name = compute_show_name(names_has_tools)
    show_emails_flag = compute_show_emails(emails_has_tools)
    show_request_limit = compute_show_request_limit(request_limits_has_tools)
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_cohorts_flag = compute_show_cohorts(len(cohorts))

    # Build show and required flags maps
    show_flags_map = {
        "names": show_name,
        "emails": show_emails_flag,
        "request_limits": show_request_limit,
        "flags": show_flag,
        "departments": show_departments_flag,
        "cohorts": show_cohorts_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "emails": compute_emails_required(),
        "request_limits": compute_request_limit_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "cohorts": compute_cohorts_required(),
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
    cohort_suggestions = [c.cohort_id for c in cohorts_suggestions]

    # Build show_ai_generate map
    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "emails": emails_show_ai_generate,
        "request_limits": request_limits_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
        "cohorts": cohorts_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions,
        "emails": email_suggestions,
        "request_limits": request_limit_suggestions,
        "departments": department_suggestions,
        "cohorts": cohort_suggestions,
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
    cohort_resources = [c for c in cohorts if c.cohort_id in selected_cohort_ids]

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
        selected_cohort_resources=cohort_resources,
        all_name_resources=names,
        all_email_resources=emails,
        all_request_limit_resources=request_limits,
        all_flag_resources=profile_flags,
        all_department_resources=departments,
        all_cohort_resources=cohorts,
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
        bypass_cache=bypass_cache,
    )

    draft_profile = None
    if draft_id is not None:
        pool = get_pool()
        if pool:
            async with pool.acquire() as conn:
                draft_items = await get_draft_profile_internal(
                    conn=conn,
                    draft_ids=[draft_id],
                    bypass_cache=bypass_cache,
                )
                if draft_items:
                    draft_profile = draft_items[0]

    return GetProfileWebsocketResponse(
        group_id=data.group_id,
        views=ProfileWebsocketViews(draft_profile=draft_profile),
        resources=ProfileWebsocketResources(
            names=[data.selected_name_resource] if data.selected_name_resource else [],
            emails=data.selected_email_resources,
            request_limits=[data.selected_request_limit_resource]
            if data.selected_request_limit_resource
            else [],
            flags=[data.selected_flag_resource] if data.selected_flag_resource else [],
            departments=data.selected_department_resources,
            cohorts=data.selected_cohort_resources,
            agents=data.config_agent_resources,
            models=data.config_model_resources,
            providers=data.config_provider_resources,
            tools=data.config_tool_resources,
        ),
        resource_agent_ids=data.agent_ids,
    )


async def get_profile_client(
    profile_id: UUID,
    target_profile_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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
        cohorts=ProfileCohortSection(
            show=data.show_flags_map.get("cohorts", False),
            required=data.required_flags_map.get("cohorts", False),
            suggestions=data.suggestions_map.get("cohorts"),
            show_ai_generate=data.show_ai_generate_map.get("cohorts", False),
            create_tool_id=data.create_tool_ids_map.get("cohorts"),
            link_tool_id=data.link_tool_ids_map.get("cohorts"),
            current=data.selected_cohort_resources,
            resources=data.all_cohort_resources,
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


@router.post(
    "/get",
    response_model=GetProfileApiResponse,
    dependencies=[
        audit_activity(
            "profile.get",
            "{{ actor.name }} {% if profile %}viewed{% else %}opened new{% endif %} profile{% if profile %} '{{ profile.name }}'{% endif %}",
        )
    ],
)
async def get_profile(
    request: GetProfileApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileApiResponse:
    """Get profile information using two-pass architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

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
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = None
            if response_data.names and response_data.names.resource:
                current_name = getattr(response_data.names.resource, "name", None)
            if request.target_profile_id and current_name:
                audit_ctx["profile"] = {
                    "name": current_name,
                    "id": str(request.target_profile_id),
                }
            audit_set(http_request, **audit_ctx)

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

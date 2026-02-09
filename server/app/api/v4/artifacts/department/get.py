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
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.department.permissions import (
    DEPARTMENT_RESOURCES,
    build_domain_data,
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
from app.api.v4.artifacts.department.types import (
    DepartmentFlagConfig,
    DepartmentResourceBucket,
    DepartmentResources,
    DomainAgent,
    GetDepartmentApiRequest,
    GetDepartmentApiResponse,
    GetDepartmentWebsocketResponse,
)
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.settings.get import get_settings_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_department_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetDepartmentAccessSqlParams,
    GetDepartmentAccessSqlRow,
    GetDepartmentIdsSqlParams,
    GetDepartmentIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/departments/get_department_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/departments/get_department_ids_complete.sql"

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

    # Domain mappings
    domain_ids_map: dict[str, UUID | None]
    agent_ids: dict[str, UUID | None]
    domains_list: list[DomainAgent]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: domain_id exists AND agent exists)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    settings_step_show_ai_generate: bool

    # Domain data for modals
    domain_data_list: list[Any]  # list[DomainData]

    # Resources payload
    resources_payload: DepartmentResources

    # Per-resource group IDs (from draft MV)
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_department_internal(
    profile_id: UUID,
    department_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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
            draft_items = await get_draft_department_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetDepartmentAccessSqlParams(
            profile_id=profile_id,
            department_id=department_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetDepartmentAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
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

    # Build per-resource group_ids from draft_item
    resource_group_ids: dict[str, UUID | None] = {
        "names": draft_item.group_id if draft_item else None,
        "descriptions": draft_item.group_id if draft_item else None,
        "flags": draft_item.group_id if draft_item else None,
        "settings": draft_item.group_id if draft_item else None,
    }

    # Get tools existence flags from Query 2
    names_has_tools = ids_result.names_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(DEPARTMENT_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=DEPARTMENT_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in DEPARTMENT_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if selected_agent_id:
            for candidate in candidate_agents:
                if candidate.agent_id == selected_agent_id:
                    create_tool_ids_map[resource] = candidate.create_tool_ids.get(
                        resource
                    )
                    link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                    break

    # === EXTRACT DOMAIN IDS FROM QUERY 2 ===
    domain_ids_map: dict[str, UUID | None] = {
        "names": ids_result.name_domain_id,
        "descriptions": ids_result.description_domain_id,
        "flags": ids_result.flag_domain_id,
        "settings": ids_result.settings_domain_id,
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        domain_id = domain_ids_map.get(resource)
        agent_id = agent_ids.get(resource)
        return domain_id is not None and agent_id is not None

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

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names_internal(c, name_ids, bypass_cache)
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                name_ids,
                bypass_cache,
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
                artifact_type="department",
            )
            suggestions = [f for f in all_flags if f.name in DEPARTMENT_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_settings():
        async with pool.acquire() as c:
            # Fetch selected settings one at a time
            selected = []
            for sid in selected_settings_ids:
                item = await get_settings_internal(c, sid, bypass_cache)
                if item:
                    selected.append(item)
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
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)
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

    # Build show and required flags maps for domain_data
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

    # Build rich domain metadata for client display
    domain_data_list = build_domain_data(
        domain_ids_map, show_flags_map, required_flags_map
    )

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
            domain_id=domain_ids_map.get("flags"),
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

    # === Construct Response ===
    resources_payload = DepartmentResources(
        resources=DepartmentResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=department_flags,
            settings=settings,
        ),
        current=DepartmentResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=[flag_resource] if flag_resource else [],
            settings=settings_resources or [],
        ),
    )

    # Build domains list for WebSocket handler
    domains_list: list[DomainAgent] = []
    for resource, domain_id in domain_ids_map.items():
        if domain_id is not None:
            domains_list.append(
                DomainAgent(
                    domain_id=domain_id,
                    agent_id=agent_ids.get(resource),
                    group_id=resource_group_ids.get(resource),
                )
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
        actor_name=access_result.actor_name,
        department_exists=access_result.department_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        domain_ids_map=domain_ids_map,
        agent_ids=agent_ids,
        domains_list=domains_list,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        settings_step_show_ai_generate=settings_step_show_ai_generate,
        domain_data_list=domain_data_list,
        resources_payload=resources_payload,
        resource_group_ids=resource_group_ids,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_department_websocket(
    profile_id: UUID,
    department_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetDepartmentWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """
    data = await get_department_internal(
        profile_id=profile_id,
        department_id=department_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetDepartmentWebsocketResponse(
        group_id=data.group_id,
        name_domain_id=data.domain_ids_map.get("names"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        settings_domain_id=data.domain_ids_map.get("settings"),
        domains=data.domains_list,
        resources=data.resources_payload,
    )


async def get_department_client(
    profile_id: UUID,
    department_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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
    )

    return GetDepartmentApiResponse(
        # Required fields
        actor_name=data.actor_name,
        department_exists=data.department_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        # Per-resource group IDs
        names_group_id=data.resource_group_ids.get("names"),
        descriptions_group_id=data.resource_group_ids.get("descriptions"),
        flags_group_id=data.resource_group_ids.get("flags"),
        settings_group_id=data.resource_group_ids.get("settings"),
        # Name
        show_name=data.show_flags_map.get("names"),
        name_domain_id=data.domain_ids_map.get("names"),
        name_required=data.required_flags_map.get("names"),
        name_suggestions=data.suggestions_map.get("names"),
        name_show_ai_generate=data.show_ai_generate_map.get("names"),
        # Description
        show_description=data.show_flags_map.get("descriptions"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        description_required=data.required_flags_map.get("descriptions"),
        description_suggestions=data.suggestions_map.get("descriptions"),
        description_show_ai_generate=data.show_ai_generate_map.get("descriptions"),
        # Flag
        show_flag=data.show_flags_map.get("flags"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        flag_required=data.required_flags_map.get("flags"),
        flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        # Settings
        show_settings=data.show_flags_map.get("settings"),
        settings_domain_id=data.domain_ids_map.get("settings"),
        settings_required=data.required_flags_map.get("settings"),
        settings_suggestions=data.suggestions_map.get("settings"),
        settings_show_ai_generate=data.show_ai_generate_map.get("settings"),
        # Step-level AI generation flags
        basic_show_ai_generate=data.basic_show_ai_generate,
        settings_step_show_ai_generate=data.settings_step_show_ai_generate,
        # Domain metadata for client display in modals
        domain_data=data.domain_data_list,
        # Resources
        resources=data.resources_payload,
        # Per-resource CREATE tool IDs
        name_create_tool_id=data.create_tool_ids_map.get("names"),
        description_create_tool_id=data.create_tool_ids_map.get("descriptions"),
        # Per-resource LINK tool IDs
        name_link_tool_id=data.link_tool_ids_map.get("names"),
        description_link_tool_id=data.link_tool_ids_map.get("descriptions"),
        flag_link_tool_id=data.link_tool_ids_map.get("flags"),
        settings_link_tool_id=data.link_tool_ids_map.get("settings"),
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


@router.post(
    "/get",
    response_model=GetDepartmentApiResponse,
    dependencies=[
        audit_activity(
            "department.get",
            "{{ actor.name }} {% if department %}viewed{% else %}opened new{% endif %} department{% if department %} '{{ department.title }}'{% endif %}",
        )
    ],
)
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
        )

        # Set audit context
        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = None
            current_resources = (
                response_data.resources.current if response_data.resources else None
            )
            if current_resources and current_resources.names:
                current_name = getattr(current_resources.names[0], "name", None)
            if request.department_id and current_name:
                audit_ctx["department"] = {
                    "title": current_name,
                    "id": str(request.department_id),
                }
            audit_set(http_request, **audit_ctx)

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

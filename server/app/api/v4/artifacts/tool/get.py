"""Tool get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_tool_internal() - Core data fetching (cacheable, returns dataclass)
2. get_tool_websocket() - Minimal data for WebSocket handlers
3. get_tool_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.tool.permissions import (
    TOOL_RESOURCES,
    build_domain_data,
    compute_args_outputs_required,
    compute_args_required,
    compute_can_edit,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_show_args,
    compute_show_args_outputs,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    has_access,
)
from app.api.v4.artifacts.tool.types import (
    DomainAgent,
    GetToolApiRequest,
    GetToolApiResponse,
    GetToolWebsocketResponse,
    ToolFlagConfig,
    ToolResourceBucket,
    ToolResources,
)
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.args.get import get_args_internal
from app.api.v4.resources.args.search import search_args_internal
from app.api.v4.resources.args_outputs.get import get_args_outputs_internal
from app.api.v4.resources.args_outputs.search import search_args_outputs_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_resources_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetToolAccessSqlParams,
    GetToolAccessSqlRow,
    GetToolIdsSqlParams,
    GetToolIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/tools/get_tool_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/tools/get_tool_ids_complete.sql"

router = APIRouter()


@dataclass
class ToolInternalData:
    """Internal data from core tool fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_tool_websocket() - minimal data for WebSocket handlers
    - get_tool_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    tool_exists: bool | None
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

    # Domain data for modals
    domain_data_list: list[Any]  # list[DomainData]

    # Resources payload
    resources_payload: ToolResources

    # Per-resource group IDs (from draft MV)
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_tool_internal(
    profile_id: UUID,
    tool_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ToolInternalData:
    """Core data fetching layer (cacheable).

    Fetches all tool data using two-pass architecture and returns
    a dataclass with all computed values.
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_resources_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetToolAccessSqlParams(
            profile_id=profile_id,
            tool_id=tool_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetToolAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        active_usage_count = access_result.active_usage_count or 0

        # Early validation: check tool exists
        if tool_id is not None:
            if access_result.tool_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Tool {tool_id} not found",
                )

            # Check access
            if not has_access(user_role):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this tool.",
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

        # === QUERY 2: ID Fetching ===
        query2_params = GetToolIdsSqlParams(
            profile_id=profile_id,
            tool_id=tool_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=[],
        )

        ids_result = cast(
            GetToolIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id

    selected_args_ids = ids_result.args_ids or []
    selected_args_outputs_ids = ids_result.args_outputs_ids or []

    # Draft values override canonical tool-junction values
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.args_ids:
            selected_args_ids = draft_item.args_ids
        if draft_item.args_outputs_ids:
            selected_args_outputs_ids = draft_item.args_outputs_ids

    # Build per-resource group_ids from draft_item
    resource_group_ids: dict[str, UUID | None] = {
        "names": draft_item.names_group_id if draft_item else None,
        "descriptions": draft_item.descriptions_group_id if draft_item else None,
        "args": draft_item.args_group_id
        if draft_item and hasattr(draft_item, "args_group_id")
        else None,
        "args_outputs": draft_item.args_outputs_group_id
        if draft_item and hasattr(draft_item, "args_outputs_group_id")
        else None,
        "flags": draft_item.flags_group_id if draft_item else None,
    }

    # Get tools existence flags from Query 2
    names_has_tools = ids_result.names_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    resources_needed = list(TOOL_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=TOOL_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=None,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in TOOL_RESOURCES:
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
        "args": ids_result.args_domain_id,
        "args_outputs": ids_result.args_outputs_domain_id,
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        domain_id = domain_ids_map.get(resource)
        agent_id = agent_ids.get(resource)
        return domain_id is not None and agent_id is not None

    show_ai_generate_map = {
        resource: compute_show_ai_generate(resource) for resource in TOOL_RESOURCES
    }

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        active_usage_count=active_usage_count,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        active_usage_count=active_usage_count,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    args_ids = selected_args_ids
    args_outputs_ids = selected_args_outputs_ids

    TOOL_FLAG_NAMES = {"tool_active"}

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names_internal(c, name_ids, bypass_cache)
            suggestions = await search_names_internal(
                c, None, 20, 0, effective_group_id, "recent", name_ids, bypass_cache
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

    async def fetch_args():
        async with pool.acquire() as c:
            selected = await get_args_internal(c, args_ids, bypass_cache)
            suggestions = await search_args_internal(
                c, None, 20, 0, None, "linked", args_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_args_outputs():
        async with pool.acquire() as c:
            selected = await get_args_outputs_internal(
                c, args_outputs_ids, bypass_cache
            )
            suggestions = await search_args_outputs_internal(
                c, None, 20, 0, None, "linked", args_outputs_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c, None, 50, 0, flag_ids, bypass_cache, artifact_type="tool"
            )
            suggestions = [f for f in all_flags if f.name in TOOL_FLAG_NAMES]
            return (selected, suggestions)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (args_selected, args_suggestions),
        (args_outputs_selected, args_outputs_suggestions),
        (flags_selected, flags_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_args(),
        fetch_args_outputs(),
        fetch_flags(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    args_list = _dedupe_by_id(args_selected + args_suggestions, "id")
    args_outputs_list = _dedupe_by_id(
        args_outputs_selected + args_outputs_suggestions, "id"
    )
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")

    # Find selected resources
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id), None
    )
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)

    args_current = [a for a in args_list if a.id in selected_args_ids]
    args_outputs_current = [
        ao for ao in args_outputs_list if ao.id in selected_args_outputs_ids
    ]

    name_suggestion_ids = [n.id for n in names_suggestions]
    description_suggestion_ids = [d.id for d in descriptions_suggestions]
    args_suggestion_ids = [a.id for a in args_suggestions]
    args_outputs_suggestion_ids = [ao.id for ao in args_outputs_suggestions]

    # Compute final show flags
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_args_flag = compute_show_args(len(args_list))
    show_args_outputs_flag = compute_show_args_outputs(len(args_outputs_list))

    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "args": show_args_flag,
        "args_outputs": show_args_outputs_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "args": compute_args_required(),
        "args_outputs": compute_args_outputs_required(),
    }

    # Build rich domain metadata for client display
    domain_data_list = build_domain_data(
        domain_ids_map, show_flags_map, required_flags_map
    )

    # Transform flags to enriched format for client
    tool_flags = [
        ToolFlagConfig(
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

    # Suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestion_ids,
        "descriptions": description_suggestion_ids,
        "args": args_suggestion_ids,
        "args_outputs": args_outputs_suggestion_ids,
    }

    # Build resources payload
    resources_payload = ToolResources(
        resources=ToolResourceBucket(
            names=names,
            descriptions=descriptions,
            args=args_list,
            args_outputs=args_outputs_list,
            flags=tool_flags,
        ),
        current=ToolResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            args=args_current or [],
            args_outputs=args_outputs_current or [],
            flags=[flag_resource] if flag_resource else [],
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

    return ToolInternalData(
        actor_name=access_result.actor_name,
        tool_exists=access_result.tool_exists,
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
        domain_data_list=domain_data_list,
        resources_payload=resources_payload,
        resource_group_ids=resource_group_ids,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_tool_websocket(
    profile_id: UUID,
    tool_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetToolWebsocketResponse:
    """Minimal response for WebSocket handlers."""
    data = await get_tool_internal(
        profile_id=profile_id,
        tool_id=tool_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetToolWebsocketResponse(
        group_id=data.group_id,
        name_domain_id=data.domain_ids_map.get("names"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        args_domain_id=data.domain_ids_map.get("args"),
        args_outputs_domain_id=data.domain_ids_map.get("args_outputs"),
        domains=data.domains_list,
        resources=data.resources_payload,
    )


async def get_tool_client(
    profile_id: UUID,
    tool_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetToolApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_tool_internal(
        profile_id=profile_id,
        tool_id=tool_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetToolApiResponse(
        # Required fields
        actor_name=data.actor_name,
        tool_exists=data.tool_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        # Per-resource group IDs
        names_group_id=data.resource_group_ids.get("names"),
        descriptions_group_id=data.resource_group_ids.get("descriptions"),
        args_group_id=data.resource_group_ids.get("args"),
        args_outputs_group_id=data.resource_group_ids.get("args_outputs"),
        flags_group_id=data.resource_group_ids.get("flags"),
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
        # Args
        show_args=data.show_flags_map.get("args"),
        args_domain_id=data.domain_ids_map.get("args"),
        args_required=data.required_flags_map.get("args"),
        args_suggestions=data.suggestions_map.get("args"),
        args_show_ai_generate=data.show_ai_generate_map.get("args"),
        # Args Outputs
        show_args_outputs=data.show_flags_map.get("args_outputs"),
        args_outputs_domain_id=data.domain_ids_map.get("args_outputs"),
        args_outputs_required=data.required_flags_map.get("args_outputs"),
        args_outputs_suggestions=data.suggestions_map.get("args_outputs"),
        args_outputs_show_ai_generate=data.show_ai_generate_map.get("args_outputs"),
        # Domain metadata for client display in modals
        domain_data=data.domain_data_list,
        # Resources
        resources=data.resources_payload,
        # Per-resource CREATE tool IDs
        name_create_tool_id=data.create_tool_ids_map.get("names"),
        description_create_tool_id=data.create_tool_ids_map.get("descriptions"),
        args_create_tool_id=data.create_tool_ids_map.get("args"),
        args_outputs_create_tool_id=data.create_tool_ids_map.get("args_outputs"),
        # Per-resource LINK tool IDs
        name_link_tool_id=data.link_tool_ids_map.get("names"),
        description_link_tool_id=data.link_tool_ids_map.get("descriptions"),
        flag_link_tool_id=data.link_tool_ids_map.get("flags"),
        args_link_tool_id=data.link_tool_ids_map.get("args"),
        args_outputs_link_tool_id=data.link_tool_ids_map.get("args_outputs"),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'tool_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("tool_", "")
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
    response_model=GetToolApiResponse,
    dependencies=[
        audit_activity(
            "tool.get",
            "{{ actor.name }} {% if tool %}viewed{% else %}opened new{% endif %} tool{% if tool %} '{{ tool.name }}'{% endif %}",
        )
    ],
)
async def get_tool(
    request: GetToolApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetToolApiResponse:
    """Get tool information using two-pass architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_tool_client(
            profile_id=profile_id,
            tool_id=request.tool_id,
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
            if request.tool_id and current_name:
                audit_ctx["tool"] = {
                    "name": current_name,
                    "id": str(request.tool_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "tools"
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
            operation="get_tool",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

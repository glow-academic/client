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
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.eval.permissions import (
    EVAL_RESOURCES,
    build_domain_data,
    compute_active_flag_required,
    compute_agents_required,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_name_required,
    compute_rubrics_required,
    compute_show_active_flag,
    compute_show_agents,
    compute_show_departments,
    compute_show_description,
    compute_show_name,
    compute_show_rubrics,
    has_access,
)
from app.api.v4.artifacts.eval.types import (
    EvalFlagConfig,
    EvalGroupRubricMapping,
    EvalResourceBucket,
    EvalResources,
    EvalRunRubricMapping,
    EvalWebsocketResources,
    EvalWebsocketViews,
    GetEvalApiRequest,
    GetEvalApiResponse,
    GetEvalWebsocketResponse,
)
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.types import CandidateAgent, DomainAgent
from app.api.v4.views.drafts.get import get_draft_eval_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetEvalAccessSqlParams,
    GetEvalAccessSqlRow,
    GetEvalIdsSqlParams,
    GetEvalIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/evals/get_eval_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/evals/get_eval_ids_complete.sql"

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

    # Domain mappings
    domain_ids_map: dict[str, UUID | None]
    domain_agent_ids: dict[str, UUID | None]
    domains_list: list[DomainAgent]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: domain_id exists AND agent exists)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool

    # Domain data for modals
    domain_data_list: list[Any]  # list[DomainData]

    # Resources payload
    resources_payload: EvalResources

    # Per-resource group IDs (from draft MV)
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Selected resource IDs (for client form state)
    name_id: UUID | None
    description_id: UUID | None
    active_flag_id: UUID | None
    dynamic_flag_id: UUID | None
    groups_flag_id: UUID | None
    department_ids: list[UUID]
    agent_ids: list[UUID]
    model_run_ids: list[UUID]
    group_ids: list[UUID]

    # Eval-specific
    run_rubrics: list[EvalRunRubricMapping]
    group_rubrics: list[EvalGroupRubricMapping]


async def get_eval_internal(
    profile_id: UUID,
    eval_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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
            draft_items = await get_draft_eval_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetEvalAccessSqlParams(
            profile_id=profile_id,
            eval_id=eval_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetEvalAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
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

    # Build per-resource group_ids from draft_item
    resource_group_ids: dict[str, UUID | None] = {
        "names": draft_item.group_id if draft_item else None,
        "descriptions": draft_item.group_id if draft_item else None,
        "flags": draft_item.group_id if draft_item else None,
        "departments": draft_item.group_id if draft_item else None,
        "agents": None,  # No draft for agents
        "rubrics": None,  # No draft for rubrics
    }

    # Get tools existence flags from Query 2
    names_has_tools = ids_result.names_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(EVAL_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=EVAL_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in EVAL_RESOURCES:
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
        "departments": ids_result.departments_domain_id,
        "agents": ids_result.agents_domain_id,
        "rubrics": ids_result.rubrics_domain_id,
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        domain_id = domain_ids_map.get(resource)
        agent_id = agent_ids.get(resource)
        return domain_id is not None and agent_id is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")
    agents_show_ai_generate = compute_show_ai_generate("agents")
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
    can_edit = compute_can_edit(
        user_role=user_role,
        eval_department_ids=eval_department_ids,
        active_usage_count=active_usage_count,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        eval_department_ids=eval_department_ids,
        active_usage_count=active_usage_count,
    )

    # === PASS 2: Parallel Resource Fetching ===

    # Selected IDs for fetching
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    active_flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    dynamic_flag_ids = [selected_dynamic_flag_id] if selected_dynamic_flag_id else []
    groups_flag_ids = [selected_groups_flag_id] if selected_groups_flag_id else []
    all_flag_ids = active_flag_ids + dynamic_flag_ids + groups_flag_ids
    department_ids = selected_department_ids

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

    # Eval-specific flag names
    EVAL_FLAG_NAMES = {"eval_active", "dynamic", ""}

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, all_flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                all_flag_ids,
                bypass_cache,
                artifact_type="eval",
            )
            suggestions = [f for f in all_flags if f.name in EVAL_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            suggestions = await search_departments_internal(
                c,
                None,
                20,
                0,
                user_department_ids,
                "all",
                department_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
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
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)

    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]

    name_suggestion_ids = [n.id for n in names_suggestions]
    description_suggestion_ids = [d.id for d in descriptions_suggestions]
    department_suggestion_ids = [d.department_id for d in departments_suggestions]

    # Compute show flags
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_active_flag = compute_show_active_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_agents_flag = compute_show_agents(len(ids_result.agent_ids or []))
    show_rubrics_flag = compute_show_rubrics(len(ids_result.rubric_ids or []))

    # Build show and required flags maps for domain_data
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_active_flag,
        "departments": show_departments_flag,
        "agents": show_agents_flag,
        "rubrics": show_rubrics_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_active_flag_required(),
        "departments": compute_departments_required(show_departments_flag),
        "agents": compute_agents_required(show_agents_flag),
        "rubrics": compute_rubrics_required(show_rubrics_flag),
    }

    # Build rich domain metadata for client display
    domain_data_list = build_domain_data(
        domain_ids_map, show_flags_map, required_flags_map
    )

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
            domain_id=domain_ids_map.get("flags"),
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
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

    # === Parse run/group rubric mappings from Q2 ===
    run_rubrics = _parse_run_rubrics(ids_result.run_rubrics)
    group_rubrics = _parse_group_rubrics(ids_result.group_rubrics)

    # === Construct Response ===
    resources_payload = EvalResources(
        resources=EvalResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=eval_flags,
            departments=departments,
            eval_agents=None,  # Populated later if needed
            rubrics=None,  # Populated later if needed
        ),
        current=EvalResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=[flag_resource] if flag_resource else [],
            departments=department_resources or [],
            eval_agents=None,
            rubrics=None,
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
        "departments": departments_show_ai_generate,
        "agents": agents_show_ai_generate,
        "rubrics": rubrics_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestion_ids,
        "descriptions": description_suggestion_ids,
        "departments": department_suggestion_ids,
    }

    return EvalInternalData(
        # Access/context
        actor_name=access_result.actor_name,
        eval_exists=access_result.eval_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        # Domain mappings
        domain_ids_map=domain_ids_map,
        domain_agent_ids=agent_ids,
        domains_list=domains_list,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        # Domain data and resources
        domain_data_list=domain_data_list,
        resources_payload=resources_payload,
        # Per-resource group IDs
        resource_group_ids=resource_group_ids,
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
        agent_ids=ids_result.agent_ids or [],
        model_run_ids=ids_result.model_run_ids or [],
        group_ids=ids_result.group_ids or [],
        # Eval-specific
        run_rubrics=run_rubrics,
        group_rubrics=group_rubrics,
    )


async def get_eval_websocket(
    profile_id: UUID,
    eval_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
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
        bypass_cache=bypass_cache,
    )

    current = data.resources_payload.current or EvalResourceBucket()

    return GetEvalWebsocketResponse(
        views=EvalWebsocketViews(draft_eval=None),
        group_id=data.group_id,
        resource_agent_ids=data.domain_agent_ids,
        resources=EvalWebsocketResources(
            names=current.names,
            descriptions=current.descriptions,
            flags=current.flags,
            departments=current.departments,
            eval_agents=current.eval_agents,
            rubrics=current.rubrics,
            run_positions=None,
            group_positions=None,
            run_rubrics=None,
            group_rubrics=None,
            agents=None,
            models=None,
            providers=None,
            tools=None,
        ),
    )


async def get_eval_client(
    profile_id: UUID,
    eval_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetEvalApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags.
    """
    data = await get_eval_internal(
        profile_id=profile_id,
        eval_id=eval_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetEvalApiResponse(
        # Required fields
        actor_name=data.actor_name,
        eval_exists=data.eval_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        # Selected resource IDs
        name_id=data.name_id,
        description_id=data.description_id,
        active_flag_id=data.active_flag_id,
        dynamic_flag_id=data.dynamic_flag_id,
        groups_flag_id=data.groups_flag_id,
        department_ids=data.department_ids or None,
        agent_ids=data.agent_ids or None,
        model_run_ids=data.model_run_ids or None,
        group_ids=data.group_ids or None,
        # Per-resource group IDs
        names_group_id=data.resource_group_ids.get("names"),
        descriptions_group_id=data.resource_group_ids.get("descriptions"),
        flags_group_id=data.resource_group_ids.get("flags"),
        departments_group_id=data.resource_group_ids.get("departments"),
        eval_agents_group_id=data.resource_group_ids.get("agents"),
        rubrics_group_id=data.resource_group_ids.get("rubrics"),
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
        # Flags: active
        show_active_flag=data.show_flags_map.get("flags"),
        active_flag_domain_id=data.domain_ids_map.get("flags"),
        active_flag_required=data.required_flags_map.get("flags"),
        active_flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        # Flags: dynamic
        show_dynamic_flag=True,
        dynamic_flag_domain_id=data.domain_ids_map.get("flags"),
        dynamic_flag_required=False,
        dynamic_flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        # Flags: groups
        show_groups_flag=True,
        groups_flag_domain_id=data.domain_ids_map.get("flags"),
        groups_flag_required=False,
        groups_flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        # Departments
        show_departments=data.show_flags_map.get("departments"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        departments_required=data.required_flags_map.get("departments"),
        department_suggestions=data.suggestions_map.get("departments"),
        departments_show_ai_generate=data.show_ai_generate_map.get("departments"),
        # Agents
        show_agents=data.show_flags_map.get("agents"),
        agents_domain_id=data.domain_ids_map.get("agents"),
        agents_required=data.required_flags_map.get("agents"),
        agents_show_ai_generate=data.show_ai_generate_map.get("agents"),
        # Rubrics
        show_rubrics=data.show_flags_map.get("rubrics"),
        rubrics_domain_id=data.domain_ids_map.get("rubrics"),
        rubrics_required=data.required_flags_map.get("rubrics"),
        rubrics_show_ai_generate=data.show_ai_generate_map.get("rubrics"),
        # Step-level AI generation flags
        basic_show_ai_generate=data.basic_show_ai_generate,
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
        departments_link_tool_id=data.link_tool_ids_map.get("departments"),
        agents_link_tool_id=data.link_tool_ids_map.get("agents"),
        rubrics_link_tool_id=data.link_tool_ids_map.get("rubrics"),
        # Eval-specific
        run_rubrics=data.run_rubrics,
        group_rubrics=data.group_rubrics,
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


def _parse_run_rubrics(raw: Any) -> list[EvalRunRubricMapping]:
    """Parse run_rubrics from SQL composite array."""
    if not raw:
        return []
    result = []
    for item in raw:
        if isinstance(item, tuple) and len(item) >= 2:
            result.append(EvalRunRubricMapping(run_id=item[0], rubric_ids=item[1]))
    return result


def _parse_group_rubrics(raw: Any) -> list[EvalGroupRubricMapping]:
    """Parse group_rubrics from SQL composite array."""
    if not raw:
        return []
    result = []
    for item in raw:
        if isinstance(item, tuple) and len(item) >= 2:
            result.append(EvalGroupRubricMapping(group_id=item[0], rubric_ids=item[1]))
    return result


@router.post(
    "/get",
    response_model=GetEvalApiResponse,
    dependencies=[
        audit_activity(
            "eval.get",
            "{{ actor.name }} {% if eval %}viewed{% else %}opened new{% endif %} eval{% if eval %} '{{ eval.name }}'{% endif %}",
        )
    ],
)
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
            if request.eval_id and current_name:
                audit_ctx["eval"] = {
                    "name": current_name,
                    "id": str(request.eval_id),
                }
            audit_set(http_request, **audit_ctx)

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

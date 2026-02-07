"""Parameter get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_parameter_internal() - Core data fetching (cacheable, returns dataclass)
2. get_parameter_websocket() - Minimal data for WebSocket handlers
3. get_parameter_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.parameter.permissions import (
    PARAMETER_FLAG_NAMES,
    PARAMETER_RESOURCES,
    build_domain_data,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_fields_required,
    compute_flag_required,
    compute_name_required,
    compute_show_departments,
    compute_show_description,
    compute_show_fields,
    compute_show_flag,
    compute_show_name,
    has_access,
)
from app.api.v4.artifacts.parameter.types import (
    DomainAgent,
    GetParameterApiRequest,
    GetParameterApiResponse,
    GetParameterWebsocketResponse,
    ParameterFlagConfig,
    ParameterResourceBucket,
    ParameterResources,
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
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameter_fields.search import (
    search_parameter_fields_internal,
)
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_resources_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetParameterAccessSqlParams,
    GetParameterAccessSqlRow,
    GetParameterIdsSqlParams,
    GetParameterIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/parameters/get_parameter_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/parameters/get_parameter_ids_complete.sql"

router = APIRouter()


@dataclass
class ParameterInternalData:
    """Internal data from core parameter fetching (cacheable layer)."""

    # Access/context
    actor_name: str | None
    parameter_exists: bool | None
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

    # Show AI generate flags
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    fields_step_show_ai_generate: bool

    # Domain data for modals
    domain_data_list: list[Any]

    # Resources payload
    resources_payload: ParameterResources

    # Per-resource group IDs (from draft MV)
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_parameter_internal(
    profile_id: UUID,
    parameter_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ParameterInternalData:
    """Core data fetching layer (cacheable)."""

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
        query1_params = GetParameterAccessSqlParams(
            profile_id=profile_id,
            parameter_id=parameter_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetParameterAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        parameter_department_ids = access_result.parameter_department_ids or []
        active_scenario_count = access_result.active_scenario_count or 0

        if parameter_id is not None:
            if access_result.parameter_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Parameter {parameter_id} not found",
                )
            if not has_access(user_role, user_department_ids, parameter_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this parameter. It may be restricted to other departments.",
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

        query2_params = GetParameterIdsSqlParams(
            profile_id=profile_id,
            parameter_id=parameter_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetParameterIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id

    selected_department_ids = ids_result.department_ids or []
    selected_field_ids = ids_result.field_ids or []

    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids
        if draft_item.parameter_field_ids:
            selected_field_ids = draft_item.parameter_field_ids

    resource_group_ids: dict[str, UUID | None] = {
        "names": draft_item.names_group_id if draft_item else None,
        "descriptions": draft_item.descriptions_group_id if draft_item else None,
        "flags": draft_item.flags_group_id if draft_item else None,
        "departments": draft_item.departments_group_id if draft_item else None,
        "fields": draft_item.parameter_fields_group_id if draft_item else None,
    }

    names_has_tools = ids_result.names_has_tools or False

    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(PARAMETER_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=PARAMETER_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in PARAMETER_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if selected_agent_id:
            for candidate in candidate_agents:
                if candidate.agent_id == selected_agent_id:
                    create_tool_ids_map[resource] = candidate.create_tool_ids.get(
                        resource
                    )
                    link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                    break

    domain_ids_map: dict[str, UUID | None] = {
        "names": ids_result.name_domain_id,
        "descriptions": ids_result.description_domain_id,
        "flags": ids_result.flag_domain_id,
        "departments": ids_result.departments_domain_id,
        "fields": ids_result.fields_domain_id,
    }

    def compute_show_ai_generate(resource: str) -> bool:
        domain_id = domain_ids_map.get(resource)
        agent_id = agent_ids.get(resource)
        return domain_id is not None and agent_id is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")
    fields_show_ai_generate = compute_show_ai_generate("fields")

    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
            departments_show_ai_generate,
        ]
    )
    fields_step_show_ai_generate = fields_show_ai_generate

    can_edit = compute_can_edit(
        user_role=user_role,
        parameter_department_ids=parameter_department_ids,
        active_scenario_count=active_scenario_count,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        parameter_department_ids=parameter_department_ids,
        active_scenario_count=active_scenario_count,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    department_ids = selected_department_ids
    field_ids = selected_field_ids

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
                artifact_type="parameter",
            )
            suggestions = [f for f in all_flags if f.name in PARAMETER_FLAG_NAMES]
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

    async def fetch_fields():
        async with pool.acquire() as c:
            selected = await get_parameter_fields_internal(c, field_ids, bypass_cache)
            available = await search_parameter_fields_internal(c, [], bypass_cache)
            return (selected, available)

    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (fields_selected, fields_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_fields(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    parameter_fields = _dedupe_by_id(fields_selected + fields_suggestions, "field_id")

    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)

    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]
    field_resources = [f for f in parameter_fields if f.id in selected_field_ids]

    name_suggestion_ids = [n.id for n in names_suggestions]
    description_suggestion_ids = [d.id for d in descriptions_suggestions]
    department_suggestion_ids = [d.department_id for d in departments_suggestions]
    field_suggestion_ids = [f.id for f in fields_suggestions]

    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_fields_flag = compute_show_fields(len(parameter_fields))

    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "fields": show_fields_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "fields": compute_fields_required(),
    }

    domain_data_list = build_domain_data(
        domain_ids_map, show_flags_map, required_flags_map
    )

    parameter_flags = [
        ParameterFlagConfig(
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

    if parameter_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    if parameter_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this parameter. It may be restricted to other departments.",
        )

    resources_payload = ParameterResources(
        resources=ParameterResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=parameter_flags,
            departments=departments,
            fields=parameter_fields,
        ),
        current=ParameterResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=[flag_resource] if flag_resource else [],
            departments=department_resources or [],
            fields=field_resources or [],
        ),
    )

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

    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "descriptions": description_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
        "fields": fields_show_ai_generate,
    }

    suggestions_map = {
        "names": name_suggestion_ids,
        "descriptions": description_suggestion_ids,
        "departments": department_suggestion_ids,
        "fields": field_suggestion_ids,
    }

    return ParameterInternalData(
        actor_name=access_result.actor_name,
        parameter_exists=access_result.parameter_exists,
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
        fields_step_show_ai_generate=fields_step_show_ai_generate,
        domain_data_list=domain_data_list,
        resources_payload=resources_payload,
        resource_group_ids=resource_group_ids,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_parameter_websocket(
    profile_id: UUID,
    parameter_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetParameterWebsocketResponse:
    """Minimal response for WebSocket handlers."""
    data = await get_parameter_internal(
        profile_id=profile_id,
        parameter_id=parameter_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetParameterWebsocketResponse(
        group_id=data.group_id,
        name_domain_id=data.domain_ids_map.get("names"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        fields_domain_id=data.domain_ids_map.get("fields"),
        domains=data.domains_list,
        resources=data.resources_payload,
    )


async def get_parameter_client(
    profile_id: UUID,
    parameter_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetParameterApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_parameter_internal(
        profile_id=profile_id,
        parameter_id=parameter_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetParameterApiResponse(
        actor_name=data.actor_name,
        parameter_exists=data.parameter_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        names_group_id=data.resource_group_ids.get("names"),
        descriptions_group_id=data.resource_group_ids.get("descriptions"),
        flags_group_id=data.resource_group_ids.get("flags"),
        departments_group_id=data.resource_group_ids.get("departments"),
        fields_group_id=data.resource_group_ids.get("fields"),
        show_name=data.show_flags_map.get("names"),
        name_domain_id=data.domain_ids_map.get("names"),
        name_required=data.required_flags_map.get("names"),
        name_suggestions=data.suggestions_map.get("names"),
        name_show_ai_generate=data.show_ai_generate_map.get("names"),
        show_description=data.show_flags_map.get("descriptions"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        description_required=data.required_flags_map.get("descriptions"),
        description_suggestions=data.suggestions_map.get("descriptions"),
        description_show_ai_generate=data.show_ai_generate_map.get("descriptions"),
        show_flag=data.show_flags_map.get("flags"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        flag_required=data.required_flags_map.get("flags"),
        flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        show_departments=data.show_flags_map.get("departments"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        departments_required=data.required_flags_map.get("departments"),
        department_suggestions=data.suggestions_map.get("departments"),
        departments_show_ai_generate=data.show_ai_generate_map.get("departments"),
        show_fields=data.show_flags_map.get("fields"),
        fields_domain_id=data.domain_ids_map.get("fields"),
        fields_required=data.required_flags_map.get("fields"),
        field_suggestions=data.suggestions_map.get("fields"),
        fields_show_ai_generate=data.show_ai_generate_map.get("fields"),
        basic_show_ai_generate=data.basic_show_ai_generate,
        fields_step_show_ai_generate=data.fields_step_show_ai_generate,
        domain_data=data.domain_data_list,
        resources=data.resources_payload,
        name_create_tool_id=data.create_tool_ids_map.get("names"),
        description_create_tool_id=data.create_tool_ids_map.get("descriptions"),
        fields_create_tool_id=data.create_tool_ids_map.get("fields"),
        name_link_tool_id=data.link_tool_ids_map.get("names"),
        description_link_tool_id=data.link_tool_ids_map.get("descriptions"),
        flag_link_tool_id=data.link_tool_ids_map.get("flags"),
        departments_link_tool_id=data.link_tool_ids_map.get("departments"),
        fields_link_tool_id=data.link_tool_ids_map.get("fields"),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'parameter_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("parameter_", "")
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
    response_model=GetParameterApiResponse,
    dependencies=[
        audit_activity(
            "parameter.get",
            "{{ actor.name }} {% if parameter %}viewed{% else %}opened new{% endif %} parameter{% if parameter %} '{{ parameter.name }}'{% endif %}",
        )
    ],
)
async def get_parameter(
    request: GetParameterApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetParameterApiResponse:
    """Get parameter information using two-pass architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_parameter_client(
            profile_id=profile_id,
            parameter_id=request.parameter_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

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
            if request.parameter_id and current_name:
                audit_ctx["parameter"] = {
                    "name": current_name,
                    "id": str(request.parameter_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "parameters"
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
            operation="get_parameter",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

"""Field get endpoint - section-first parity (three-layer architecture)."""

from __future__ import annotations

import asyncio
from dataclasses import replace
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.field.permissions import (
    FIELD_RESOURCES,
    compute_can_edit,
    compute_conditional_parameters_required,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_show_conditional_parameters,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    has_access,
)
from app.api.v4.artifacts.field.types import (
    FieldConditionalParameterSection,
    FieldDepartmentSection,
    FieldDescriptionSection,
    FieldFlagConfig,
    FieldFlagSection,
    FieldInternalData,
    FieldNameSection,
    FieldWebsocketResources,
    FieldWebsocketViews,
    GetFieldApiRequest,
    GetFieldApiResponse,
    GetFieldWebsocketResponse,
)
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.parameters.search import search_parameters_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_field_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetFieldAccessSqlParams,
    GetFieldAccessSqlRow,
    GetFieldIdsSqlParams,
    GetFieldIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

QUERY1_SQL_PATH = "app/sql/v4/queries/fields/get_field_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/fields/get_field_ids_complete.sql"

router = APIRouter()


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("field_", "")
    return (key, key.replace("_", " ").title())


def _dedupe_by_id(items: list[Any], id_attr: str) -> list[Any]:
    seen: set[UUID] = set()
    output: list[Any] = []
    for item in items:
        item_id = getattr(item, id_attr, None)
        if item_id and item_id not in seen:
            seen.add(item_id)
            output.append(item)
    return output


def _normalize_field_resource_alias(resource: str) -> str:
    return "conditional_parameters" if resource == "parameters" else resource


async def get_field_internal(
    profile_id: UUID,
    field_id: UUID | None,
    draft_id: UUID | None = None,
    description_search: str | None = None,
    conditional_parameter_search: str | None = None,
    conditional_parameter_show_selected: bool | None = None,
    bypass_cache: bool = False,
) -> FieldInternalData:
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_field_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        access_result = cast(
            GetFieldAccessSqlRow,
            await execute_sql_typed(
                conn,
                QUERY1_SQL_PATH,
                params=GetFieldAccessSqlParams(
                    profile_id=profile_id,
                    field_id=field_id,
                    draft_id=draft_id,
                ),
            ),
        )

        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        field_department_ids = access_result.field_department_ids or []

        if field_id is not None:
            if access_result.field_exists is False:
                raise HTTPException(status_code=404, detail=f"Field {field_id} not found")
            if not has_access(user_role, user_department_ids, field_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this field. It may be restricted to other departments.",
                )

        effective_group_id = (
            draft_item.group_id
            if draft_item is not None and draft_item.group_id is not None
            else access_result.group_id
        )
        effective_draft_version = (
            draft_item.version if draft_item is not None else access_result.draft_version
        )

        ids_result = cast(
            GetFieldIdsSqlRow,
            await execute_sql_typed(
                conn,
                QUERY2_SQL_PATH,
                params=GetFieldIdsSqlParams(
                    profile_id=profile_id,
                    field_id=field_id,
                    draft_id=draft_id,
                    group_id=effective_group_id,
                    user_department_ids=user_department_ids,
                ),
            ),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_department_ids = ids_result.department_ids or []
    selected_conditional_parameter_ids = ids_result.conditional_parameter_ids or []

    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids
        if draft_item.parameter_ids:
            selected_conditional_parameter_ids = draft_item.parameter_ids

    raw_candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)
    candidate_agents: list[CandidateAgent] = []
    for candidate in raw_candidate_agents:
        normalized_tool_resources = {
            _normalize_field_resource_alias(resource)
            for resource in candidate.tool_resources
        }
        normalized_create_tool_ids = {
            _normalize_field_resource_alias(resource): tool_id
            for resource, tool_id in candidate.create_tool_ids.items()
        }
        normalized_link_tool_ids = {
            _normalize_field_resource_alias(resource): tool_id
            for resource, tool_id in candidate.link_tool_ids.items()
        }
        candidate_agents.append(
            replace(
                candidate,
                tool_resources=normalized_tool_resources,
                create_tool_ids=normalized_create_tool_ids,
                link_tool_ids=normalized_link_tool_ids,
            )
        )
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=FIELD_RESOURCES,
        resources_needed=list(FIELD_RESOURCES),
        user_department_ids=set(user_department_ids) if user_department_ids else None,
        require_mcp=False,
    )

    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}
    for resource in FIELD_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if not selected_agent_id:
            continue
        for candidate in candidate_agents:
            if candidate.agent_id == selected_agent_id:
                create_tool_ids_map[resource] = candidate.create_tool_ids.get(resource)
                link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                break

    show_ai_generate_map = {
        "names": agent_ids.get("names") is not None,
        "descriptions": agent_ids.get("descriptions") is not None,
        "flags": agent_ids.get("flags") is not None,
        "departments": agent_ids.get("departments") is not None,
        "conditional_parameters": agent_ids.get("conditional_parameters") is not None,
    }

    basic_show_ai_generate = any(
        [
            show_ai_generate_map["names"],
            show_ai_generate_map["descriptions"],
            show_ai_generate_map["flags"],
            show_ai_generate_map["departments"],
        ]
    )

    can_edit = compute_can_edit(user_role=user_role, field_department_ids=field_department_ids)
    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        field_department_ids=field_department_ids,
    )

    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []

    async def fetch_names():
        async with pool.acquire() as c:
            return (
                await get_names_internal(c, name_ids, bypass_cache),
                await search_names_internal(
                    c,
                    None,
                    20,
                    0,
                    effective_group_id,
                    "recent",
                    name_ids,
                    bypass_cache,
                ),
            )

    async def fetch_descriptions():
        async with pool.acquire() as c:
            return (
                await get_descriptions_internal(c, description_ids, bypass_cache),
                await search_descriptions_internal(
                    c,
                    description_search,
                    20,
                    0,
                    effective_group_id,
                    "recent",
                    description_ids,
                    bypass_cache,
                ),
            )

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
                artifact_type="field",
            )
            suggestions = [f for f in all_flags if f.name == "field_active"]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            return (
                await get_departments_internal(c, selected_department_ids, bypass_cache),
                await search_departments_internal(
                    c,
                    None,
                    20,
                    0,
                    user_department_ids,
                    "all",
                    selected_department_ids,
                    bypass_cache,
                ),
            )

    async def fetch_conditional_parameters():
        async with pool.acquire() as c:
            exclude_ids = (
                [] if (conditional_parameter_show_selected or False) else selected_conditional_parameter_ids
            )
            return (
                await get_parameters_internal(c, selected_conditional_parameter_ids, bypass_cache),
                await search_parameters_internal(
                    c,
                    conditional_parameter_search,
                    20,
                    0,
                    None,
                    None,
                    None,
                    None,
                    "all",
                    exclude_ids,
                    bypass_cache,
                ),
            )

    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (conditional_parameters_selected, conditional_parameters_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_conditional_parameters(),
    )

    all_names = _dedupe_by_id(names_selected + names_suggestions, "id")
    all_descriptions = _dedupe_by_id(
        descriptions_selected + descriptions_suggestions,
        "id",
    )
    all_flags_raw = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    all_departments = _dedupe_by_id(
        departments_selected + departments_suggestions,
        "department_id",
    )
    all_conditional_parameters = _dedupe_by_id(
        conditional_parameters_selected + conditional_parameters_suggestions,
        "parameter_id",
    )

    name_resource = next((n for n in all_names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in all_descriptions if d.id == selected_description_id),
        None,
    )
    flag_resource = next(
        (f for f in all_flags_raw if f.id == selected_active_flag_id),
        None,
    )

    selected_departments = [
        d for d in all_departments if d.department_id in selected_department_ids
    ]
    selected_conditional_parameters = [
        p
        for p in all_conditional_parameters
        if p.parameter_id in selected_conditional_parameter_ids
    ]

    show_flags_map = {
        "names": compute_show_name(ids_result.names_has_tools or False),
        "descriptions": compute_show_description(),
        "flags": compute_show_flag(),
        "departments": compute_show_departments(len(all_departments)),
        "conditional_parameters": compute_show_conditional_parameters(
            len(all_conditional_parameters)
        ),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "conditional_parameters": compute_conditional_parameters_required(),
    }

    all_flags = [
        FieldFlagConfig(
            key=derive_flag_key_and_label(f.name)[0],
            label=derive_flag_key_and_label(f.name)[1],
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            show=show_flags_map["flags"],
            required=required_flags_map["flags"],
            generated=f.generated,
        )
        for f in all_flags_raw
        if f.id
    ]
    selected_flag = next(
        (f for f in all_flags if f.flag_option_id == selected_active_flag_id),
        None,
    )

    if field_id is None and not all_departments:
        raise HTTPException(status_code=400, detail="No accessible departments found for user")

    selected_agent_ids = list({aid for aid in agent_ids.values() if aid is not None})

    config_agents = []
    config_models = []
    config_providers = []
    config_tools = []
    if selected_agent_ids:
        async with pool.acquire() as config_conn:
            config_agents = await get_agents_internal(
                config_conn,
                selected_agent_ids,
                bypass_cache,
            )
            model_ids = list(
                {
                    agent.model_id
                    for agent in config_agents
                    if agent.model_id is not None
                }
            )
            if model_ids:
                config_models = await get_models_internal(
                    config_conn,
                    model_ids,
                    bypass_cache,
                )
                provider_ids = list(
                    {
                        model.provider_id
                        for model in config_models
                        if model.provider_id is not None
                    }
                )
                if provider_ids:
                    config_providers = await get_providers_internal(
                        config_conn,
                        provider_ids,
                        bypass_cache,
                    )
            tool_ids = list(
                {
                    tool_id
                    for agent in config_agents
                    for tool_id in (agent.tool_ids or [])
                    if tool_id is not None
                }
            )
            if tool_ids:
                config_tools = await get_tools_internal(
                    config_conn,
                    tool_ids,
                    bypass_cache,
                )

    return FieldInternalData(
        actor_name=access_result.actor_name,
        field_exists=access_result.field_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        agent_ids=agent_ids,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map={
            "names": [n.id for n in names_suggestions],
            "descriptions": [d.id for d in descriptions_suggestions],
            "departments": [d.department_id for d in departments_suggestions],
            "conditional_parameters": [
                p.parameter_id for p in conditional_parameters_suggestions
            ],
        },
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        selected_names=[name_resource] if name_resource else [],
        all_names=all_names,
        selected_descriptions=[description_resource] if description_resource else [],
        all_descriptions=all_descriptions,
        selected_flags=[selected_flag] if selected_flag else [],
        all_flags=all_flags,
        selected_departments=selected_departments,
        all_departments=all_departments,
        selected_conditional_parameters=selected_conditional_parameters,
        all_conditional_parameters=all_conditional_parameters,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        draft_view=draft_item,
    )


async def get_field_websocket(
    profile_id: UUID,
    field_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetFieldWebsocketResponse:
    data = await get_field_internal(
        profile_id=profile_id,
        field_id=field_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )
    return GetFieldWebsocketResponse(
        group_id=data.group_id,
        views=FieldWebsocketViews(draft_field=data.draft_view),
        resources=FieldWebsocketResources(
            names=data.selected_names,
            descriptions=data.selected_descriptions,
            flags=data.selected_flags,
            departments=data.selected_departments,
            conditional_parameters=data.selected_conditional_parameters,
            agents=data.config_agents,
            models=data.config_models,
            providers=data.config_providers,
            tools=data.config_tools,
        ),
        resource_agent_ids=data.agent_ids,
    )


async def get_field_client(
    profile_id: UUID,
    field_id: UUID | None,
    draft_id: UUID | None = None,
    description_search: str | None = None,
    conditional_parameter_search: str | None = None,
    conditional_parameter_show_selected: bool | None = None,
    bypass_cache: bool = False,
) -> GetFieldApiResponse:
    data = await get_field_internal(
        profile_id=profile_id,
        field_id=field_id,
        draft_id=draft_id,
        description_search=description_search,
        conditional_parameter_search=conditional_parameter_search,
        conditional_parameter_show_selected=conditional_parameter_show_selected,
        bypass_cache=bypass_cache,
    )

    return GetFieldApiResponse(
        actor_name=data.actor_name,
        field_exists=data.field_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        names=FieldNameSection(
            resource=(data.selected_names or [None])[0],
            resources=data.all_names,
            show=data.show_flags_map.get("names", False),
            required=data.required_flags_map.get("names", False),
            suggestions=data.suggestions_map.get("names"),
            show_ai_generate=data.show_ai_generate_map.get("names", False),
            create_tool_id=data.create_tool_ids_map.get("names"),
            link_tool_id=data.link_tool_ids_map.get("names"),
        ),
        descriptions=FieldDescriptionSection(
            resource=(data.selected_descriptions or [None])[0],
            resources=data.all_descriptions,
            show=data.show_flags_map.get("descriptions", False),
            required=data.required_flags_map.get("descriptions", False),
            suggestions=data.suggestions_map.get("descriptions"),
            show_ai_generate=data.show_ai_generate_map.get("descriptions", False),
            create_tool_id=data.create_tool_ids_map.get("descriptions"),
            link_tool_id=data.link_tool_ids_map.get("descriptions"),
        ),
        flags=FieldFlagSection(
            resource=(data.selected_flags or [None])[0],
            resources=data.all_flags,
            show=data.show_flags_map.get("flags", False),
            required=data.required_flags_map.get("flags", False),
            show_ai_generate=data.show_ai_generate_map.get("flags", False),
            link_tool_id=data.link_tool_ids_map.get("flags"),
        ),
        departments=FieldDepartmentSection(
            current=data.selected_departments,
            resources=data.all_departments,
            show=data.show_flags_map.get("departments", False),
            required=data.required_flags_map.get("departments", False),
            suggestions=data.suggestions_map.get("departments"),
            show_ai_generate=data.show_ai_generate_map.get("departments", False),
            link_tool_id=data.link_tool_ids_map.get("departments"),
        ),
        conditional_parameters=FieldConditionalParameterSection(
            current=data.selected_conditional_parameters,
            resources=data.all_conditional_parameters,
            show=data.show_flags_map.get("conditional_parameters", False),
            required=data.required_flags_map.get("conditional_parameters", False),
            suggestions=data.suggestions_map.get("conditional_parameters"),
            show_ai_generate=data.show_ai_generate_map.get(
                "conditional_parameters",
                False,
            ),
            link_tool_id=data.link_tool_ids_map.get("conditional_parameters"),
        ),
    )


@router.post(
    "/get",
    response_model=GetFieldApiResponse,
    dependencies=[
        audit_activity(
            "field.get",
            "{{ actor.name }} {% if field %}viewed{% else %}opened new{% endif %} field{% if field %} '{{ field.name }}'{% endif %}",
        )
    ],
)
async def get_field(
    request: GetFieldApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFieldApiResponse:
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(status_code=401, detail="Profile ID is required. Please sign in again.")

        response_data = await get_field_client(
            profile_id=profile_id,
            field_id=request.field_id,
            draft_id=request.draft_id,
            description_search=request.description_search,
            conditional_parameter_search=request.conditional_parameter_search,
            conditional_parameter_show_selected=request.conditional_parameter_show_selected,
            bypass_cache=bypass_cache,
        )

        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = (
                response_data.names.resource.name
                if response_data.names and response_data.names.resource
                else None
            )
            if request.field_id and current_name:
                audit_ctx["field"] = {"name": current_name, "id": str(request.field_id)}
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "fields"
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
            operation="get_field",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

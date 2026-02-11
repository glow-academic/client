"""Provider get endpoint - Three-layer architecture."""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.provider.permissions import (
    PROVIDER_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_endpoint_required,
    compute_flag_required,
    compute_key_required,
    compute_name_required,
    compute_show_departments,
    compute_show_description,
    compute_show_endpoint,
    compute_show_flag,
    compute_show_key,
    compute_show_name,
    compute_show_value,
    compute_value_required,
    has_access,
)
from app.api.v4.artifacts.provider.types import (
    GetProviderApiRequest,
    GetProviderApiResponse,
    GetProviderWebsocketResponse,
    ProviderDepartmentSection,
    ProviderDescriptionSection,
    ProviderEndpointSection,
    ProviderFlagConfig,
    ProviderFlagSection,
    ProviderInternalData,
    ProviderKeySection,
    ProviderNameSection,
    ProviderValueSection,
    ProviderWebsocketResources,
    ProviderWebsocketViews,
)
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.endpoints.get import get_endpoints_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.keys.get import get_keys_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.resources.values.get import get_values_internal
from app.api.v4.resources.values.search import search_values_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_provider_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetProviderAccessSqlParams,
    GetProviderAccessSqlRow,
    GetProviderIdsSqlParams,
    GetProviderIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

QUERY1_SQL_PATH = "app/sql/v4/queries/providers/get_provider_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/providers/get_provider_ids_complete.sql"

router = APIRouter()


async def get_provider_internal(
    profile_id: UUID,
    provider_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ProviderInternalData:
    """Core data fetching layer (cacheable)."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_provider_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetProviderAccessSqlParams(
            profile_id=profile_id,
            provider_id=provider_id,
            draft_id=draft_id,
        )
        access_result = cast(
            GetProviderAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        provider_department_ids = access_result.provider_department_ids or []
        model_usage_count = access_result.model_usage_count or 0

        if provider_id is not None:
            if access_result.provider_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Provider {provider_id} not found",
                )
            if not has_access(user_role, user_department_ids, provider_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this provider. It may be restricted to other departments.",
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

        query2_params = GetProviderIdsSqlParams(
            profile_id=profile_id,
            provider_id=provider_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )
        ids_result = cast(
            GetProviderIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_value_id = ids_result.value_id
    selected_endpoint_id = ids_result.endpoint_id
    selected_key_id = ids_result.key_id
    selected_department_ids = ids_result.department_ids or []

    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.value_ids:
            selected_value_id = draft_item.value_ids[0]
        endpoint_ids = getattr(draft_item, "endpoint_ids", [])
        if endpoint_ids:
            selected_endpoint_id = endpoint_ids[0]
        key_ids = getattr(draft_item, "key_ids", [])
        if key_ids:
            selected_key_id = key_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids

    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=PROVIDER_RESOURCES,
        resources_needed=list(PROVIDER_RESOURCES),
        user_department_ids=set(user_department_ids) if user_department_ids else None,
        require_mcp=False,
    )

    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}
    for resource in PROVIDER_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if selected_agent_id is None:
            continue
        for candidate in candidate_agents:
            if candidate.agent_id == selected_agent_id:
                create_tool_ids_map[resource] = candidate.create_tool_ids.get(resource)
                link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                break

    show_ai_generate_map = {
        resource: agent_ids.get(resource) is not None for resource in PROVIDER_RESOURCES
    }
    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False)
        for r in ("names", "descriptions", "flags", "departments")
    )
    integrations_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in ("values", "endpoints")
    )
    show_ai_generate_map["keys"] = False

    can_edit = compute_can_edit(
        user_role=user_role,
        provider_department_ids=provider_department_ids,
        model_usage_count=model_usage_count,
    )
    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        provider_department_ids=provider_department_ids,
        model_usage_count=model_usage_count,
    )

    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    department_ids = selected_department_ids
    value_ids = [selected_value_id] if selected_value_id else []
    endpoint_ids = [selected_endpoint_id] if selected_endpoint_id else []
    key_ids = [selected_key_id] if selected_key_id else []

    endpoint_suggestion_ids = ids_result.endpoint_suggestion_ids or []
    key_suggestion_ids = ids_result.key_suggestion_ids or []

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

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c, None, 50, 0, flag_ids, bypass_cache, artifact_type="provider"
            )
            suggestions = [f for f in all_flags if (f.name or "") == "provider_active"]
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

    async def fetch_values():
        async with pool.acquire() as c:
            selected = await get_values_internal(c, value_ids, bypass_cache)
            suggestions = await search_values_internal(
                c, None, 20, 0, effective_group_id, "recent", value_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_endpoints():
        async with pool.acquire() as c:
            selected = await get_endpoints_internal(c, endpoint_ids, bypass_cache)
            suggestions = await get_endpoints_internal(
                c, endpoint_suggestion_ids, bypass_cache
            )
            return (selected, suggestions)

    async def fetch_keys():
        async with pool.acquire() as c:
            selected = await get_keys_internal(c, key_ids, bypass_cache)
            suggestions = await get_keys_internal(c, key_suggestion_ids, bypass_cache)
            return (selected, suggestions)

    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (values_selected, values_suggestions),
        (endpoints_selected, endpoints_suggestions),
        (keys_selected, keys_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_values(),
        fetch_endpoints(),
        fetch_keys(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    raw_flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    values = _dedupe_by_id(values_selected + values_suggestions, "id")
    endpoints = _dedupe_by_id(endpoints_selected + endpoints_suggestions, "id")
    keys = _dedupe_by_id(keys_selected + keys_suggestions, "id")

    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id), None
    )
    value_resource = next((v for v in values if v.id == selected_value_id), None)
    endpoint_resource = next(
        (e for e in endpoints if e.id == selected_endpoint_id), None
    )
    key_resource = next((k for k in keys if k.id == selected_key_id), None)
    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]

    show_flags_map = {
        "names": compute_show_name(ids_result.names_has_tools or False),
        "descriptions": compute_show_description(),
        "flags": compute_show_flag(),
        "departments": compute_show_departments(len(departments)),
        "values": compute_show_value(),
        "endpoints": compute_show_endpoint(),
        "keys": compute_show_key(),
    }
    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "values": compute_value_required(),
        "endpoints": compute_endpoint_required(),
        "keys": compute_key_required(),
    }

    provider_flags = [
        ProviderFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flags_map["flags"],
            required=required_flags_map["flags"],
            generated=flag.generated,
        )
        for flag in raw_flags
        if flag.id
    ]

    selected_flag = next(
        (
            f
            for f in provider_flags
            if f.flag_option_id is not None
            and f.flag_option_id == selected_active_flag_id
        ),
        None,
    )
    selected_flags = [selected_flag] if selected_flag else []

    selected_agent_ids = [aid for aid in agent_ids.values() if aid]
    unique_agent_ids = list(dict.fromkeys(selected_agent_ids))
    config_agents_result: list[Any] = []
    config_models_result: list[Any] = []
    config_providers_result: list[Any] = []
    if unique_agent_ids:
        async with pool.acquire() as c:
            config_agents_result = await get_agents_internal(
                c, unique_agent_ids, bypass_cache
            )
    model_ids_for_config = list(
        dict.fromkeys(
            [
                getattr(agent, "model_id", None)
                for agent in config_agents_result
                if getattr(agent, "model_id", None) is not None
            ]
        )
    )
    if model_ids_for_config:
        async with pool.acquire() as c:
            config_models_result = await get_models_internal(
                c, model_ids_for_config, bypass_cache
            )
    provider_ids_for_config = list(
        dict.fromkeys(
            [
                getattr(model, "provider_id", None)
                for model in config_models_result
                if getattr(model, "provider_id", None) is not None
            ]
        )
    )
    if provider_ids_for_config:
        async with pool.acquire() as c:
            config_providers_result = await get_providers_internal(
                c, provider_ids_for_config, bypass_cache
            )

    if provider_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this provider. It may be restricted to other departments.",
        )

    return ProviderInternalData(
        actor_name=access_result.actor_name,
        provider_exists=access_result.provider_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        agent_ids=agent_ids,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map={
            "names": [n.id for n in names_suggestions if n.id],
            "descriptions": [d.id for d in descriptions_suggestions if d.id],
            "departments": [
                d.department_id for d in departments_suggestions if d.department_id
            ],
            "values": [v.id for v in values_suggestions if v.id],
            "endpoints": [e.id for e in endpoints_suggestions if e.id],
            "keys": [k.id for k in keys_suggestions if k.id],
        },
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        integrations_show_ai_generate=integrations_show_ai_generate,
        name_resource=name_resource,
        description_resource=description_resource,
        value_resource=value_resource,
        endpoint_resource=endpoint_resource,
        key_resource=key_resource,
        provider_flags=selected_flags,
        department_resources=department_resources,
        names=names,
        descriptions=descriptions,
        flags=provider_flags,
        departments=departments,
        values=values,
        endpoints=endpoints,
        keys=keys,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        config_agent_resources=config_agents_result or None,
        config_model_resources=config_models_result or None,
        config_provider_resources=config_providers_result or None,
    )


async def get_provider_websocket(
    profile_id: UUID,
    provider_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetProviderWebsocketResponse:
    """Minimal response for WebSocket handlers."""
    data = await get_provider_internal(
        profile_id=profile_id,
        provider_id=provider_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    draft_view = None
    if draft_id is not None:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")
        async with pool.acquire() as conn:
            draft_items = await get_draft_provider_internal(
                conn=conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            draft_view = draft_items[0] if draft_items else None

    selected_tool_ids = set()
    for agent in data.config_agent_resources or []:
        for tool_id in getattr(agent, "tool_ids", []) or []:
            if tool_id:
                selected_tool_ids.add(tool_id)
    tools_result = None
    if selected_tool_ids:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")
        async with pool.acquire() as conn:
            tools_result = await get_tools_internal(
                conn, list(selected_tool_ids), bypass_cache
            )

    return GetProviderWebsocketResponse(
        views=ProviderWebsocketViews(draft_provider=draft_view) if draft_view else None,
        group_id=data.group_id,
        resource_agent_ids=data.agent_ids,
        resources=ProviderWebsocketResources(
            names=[data.name_resource] if data.name_resource else None,
            descriptions=[data.description_resource]
            if data.description_resource
            else None,
            flags=data.provider_flags or None,
            departments=data.department_resources or None,
            values=[data.value_resource] if data.value_resource else None,
            endpoints=[data.endpoint_resource] if data.endpoint_resource else None,
            keys=[data.key_resource] if data.key_resource else None,
            agents=data.config_agent_resources,
            models=data.config_model_resources,
            providers=data.config_provider_resources,
            tools=tools_result or None,
        ),
    )


async def get_provider_client(
    profile_id: UUID,
    provider_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetProviderApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_provider_internal(
        profile_id=profile_id,
        provider_id=provider_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    def section_common(resource_key: str) -> dict[str, Any]:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key, []),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "create_tool_id": data.create_tool_ids_map.get(resource_key),
            "link_tool_id": data.link_tool_ids_map.get(resource_key),
        }

    return GetProviderApiResponse(
        actor_name=data.actor_name,
        provider_exists=data.provider_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        integrations_show_ai_generate=data.integrations_show_ai_generate,
        names=ProviderNameSection(
            resource=data.name_resource,
            resources=data.names,
            **section_common("names"),
        ),
        descriptions=ProviderDescriptionSection(
            resource=data.description_resource,
            resources=data.descriptions,
            **section_common("descriptions"),
        ),
        flags=ProviderFlagSection(
            current=data.provider_flags or None,
            resources=data.flags,
            **section_common("flags"),
        ),
        departments=ProviderDepartmentSection(
            current=data.department_resources or None,
            resources=data.departments,
            **section_common("departments"),
        ),
        values=ProviderValueSection(
            resource=data.value_resource,
            resources=data.values,
            **section_common("values"),
        ),
        endpoints=ProviderEndpointSection(
            resource=data.endpoint_resource,
            resources=data.endpoints,
            **section_common("endpoints"),
        ),
        keys=ProviderKeySection(
            resource=data.key_resource,
            resources=data.keys,
            **section_common("keys"),
        ),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("provider_", "")
    label = key.replace("_", " ").title()
    return (key, label)


def _dedupe_by_id(items: list[Any], id_attr: str) -> list[Any]:
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
    response_model=GetProviderApiResponse,
    dependencies=[
        audit_activity(
            "provider.get",
            "{{ actor.name }} {% if provider %}viewed{% else %}opened new{% endif %} provider{% if provider %} '{{ provider.name }}'{% endif %}",
        )
    ],
)
async def get_provider(
    request: GetProviderApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProviderApiResponse:
    """Get provider information using two-pass architecture."""
    _ = conn
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_provider_client(
            profile_id=profile_id,
            provider_id=request.provider_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = (
                response_data.names.resource.name if response_data.names else None
            )
            if request.provider_id and current_name:
                audit_ctx["provider"] = {
                    "name": current_name,
                    "id": str(request.provider_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "providers"
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
            operation="get_provider",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

"""Provider get endpoint - Three-layer architecture."""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.provider.permissions import (
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
from app.v5.api.main.provider.types import (
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
    ProviderWebsocketEntries,
    ProviderWebsocketResources,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.auth.settings import get_auth_settings_internal
from app.v5.api.entries.provider_drafts.get import get_provider_drafts_entries_internal
from app.v5.api.entries.runs.search import get_run_list_entries_internal
from app.v5.api.permissions import has_tools_for_resource, resolve_agents_for_artifact
from app.v5.api.resources.agents.get import get_agents_internal
from app.v5.api.resources.args.get import get_args_internal
from app.v5.api.resources.args_outputs.get import get_args_outputs_internal
from app.v5.api.resources.departments.get import get_departments_internal
from app.v5.api.resources.departments.search import search_departments_internal
from app.v5.api.resources.descriptions.get import get_descriptions_internal
from app.v5.api.resources.descriptions.search import search_descriptions_internal
from app.v5.api.resources.endpoints.get import get_endpoints_internal
from app.v5.api.resources.flags.get import get_flags_internal
from app.v5.api.resources.flags.search import search_flags_internal
from app.v5.api.resources.keys.get import get_keys_internal
from app.v5.api.resources.models.get import get_models_internal
from app.v5.api.resources.names.get import get_names_internal
from app.v5.api.resources.names.search import search_names_internal
from app.v5.api.resources.profiles.get import get_profiles_internal
from app.v5.api.resources.providers.get import get_providers_internal
from app.v5.api.resources.tools.get import get_tools_internal
from app.v5.api.resources.values.get import get_values_internal
from app.v5.api.resources.values.search import search_values_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.sql.types import (
    GetProviderAccessSqlParams,
    GetProviderAccessSqlRow,
    GetProviderIdsSqlParams,
    GetProviderIdsSqlRow,
    load_sql_query,
)
from app.v5.utils.sql_helper import execute_sql_typed

QUERY1_SQL_PATH = "app/v5/sql/queries/providers/get_provider_access_complete.sql"
QUERY2_SQL_PATH = "app/v5/sql/queries/providers/get_provider_ids_complete.sql"

router = APIRouter()


async def get_provider_internal(
    profile_id: UUID,
    provider_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> ProviderInternalData:
    """Core data fetching layer (cacheable)."""
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Resolve shared profile context first (default path).
    async with pool.acquire() as context_conn:
        profile_ctx = await get_auth_profile_internal(
            conn=context_conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

    # Extract user context from internal fetch (single source of truth)
    user_role = profile_ctx.access.role
    actor_name = profile_ctx.access.actor_name
    user_department_ids = [
        d.department_id for d in profile_ctx.departments if d.department_id
    ]

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_provider_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetProviderAccessSqlParams(
            profile_id=profile_id,
            provider_id=provider_id,
            draft_id=draft_id,
            draft_group_id=draft_item.group_id if draft_item is not None else None,
            draft_version=draft_item.version if draft_item is not None else None,
        )
        access_result = cast(
            GetProviderAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract artifact-specific state from Query 1 (no user context)
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

        # group_id is guaranteed by SQL (created inline if no draft)
        if group_id:
            effective_group_id = group_id
        else:
            effective_group_id = access_result.group_id
        effective_draft_version = access_result.effective_draft_version

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

    # === RESOLVE AGENTS FROM SETTINGS ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, PROVIDER_RESOURCES
    )

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
        user_department_ids=user_department_ids,
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
                c,
                None,
                20,
                0,
                effective_group_id,
                None,
                name_ids,
                bypass_cache,
                provider=True,
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
                provider=True,
            )
            return (selected, suggestions)

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c, None, 50, 0, flag_ids, bypass_cache, provider=True
            )
            suggestions = [f for f in all_flags if (f.name or "") == "provider_active"]
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
                provider=True,
            )
            return (selected, suggestions)

    async def fetch_values():
        async with pool.acquire() as c:
            selected = await get_values_internal(c, value_ids, bypass_cache)
            suggestions = await search_values_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                value_ids,
                bypass_cache,
                provider=True,
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
        "names": compute_show_name(
            has_tools_for_resource(settings_data.agent_tool_entries, "names")
        ),
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

    config_agent_resource_ids = [a.id for a in settings_data.settings_agents if a.id]
    config_model_resource_ids = [
        a.model_id for a in settings_data.settings_agents if a.model_id
    ]

    config_agents_result: list[Any] = []
    config_models_result: list[Any] = []
    config_providers_result: list[Any] = []
    if config_agent_resource_ids:
        async with pool.acquire() as c:
            config_agents_result = await get_agents_internal(
                c, config_agent_resource_ids, bypass_cache
            )
    if config_model_resource_ids:
        async with pool.acquire() as c:
            config_models_result = await get_models_internal(
                c, config_model_resource_ids, bypass_cache
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
        actor_name=actor_name,
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
    from datetime import UTC

    data = await get_provider_internal(
        profile_id=profile_id,
        provider_id=provider_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # Fetch draft, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_provider_drafts_entries_internal(
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
        from datetime import datetime

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
        selected_tool_ids = set()
        for agent in data.config_agent_resources:
            for tool_id in getattr(agent, "tool_ids", []) or []:
                if tool_id:
                    selected_tool_ids.add(tool_id)
        if not selected_tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools_internal(c, list(selected_tool_ids), bypass_cache)

    (
        draft_view,
        config_profile_result,
        runs_result,
        tools_result,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    # Build views (always construct — both fields optional now)
    entries = ProviderWebsocketEntries(
        draft_provider=draft_view,
        runs=runs_result,
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    tools = tools_result or []
    config_args = None
    config_args_outputs = None
    if tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in tools:
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

    return GetProviderWebsocketResponse(
        entries=entries if draft_view or runs_result else None,
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
        ),
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetProviderApiRequest(provider_id=provider_id, draft_id=draft_id),
    )


async def get_provider_client(
    profile_id: UUID,
    provider_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetProviderApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_provider_internal(
        profile_id=profile_id,
        provider_id=provider_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        group_id=group_id,
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


@router.post("/get", response_model=GetProviderApiResponse)
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
            group_id=request.group_id,
        )

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

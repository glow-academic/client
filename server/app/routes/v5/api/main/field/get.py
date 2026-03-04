"""Field get endpoint - section-first parity (three-layer architecture)."""

from __future__ import annotations

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool, get_redis_client
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.field.permissions import (
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
from app.routes.v5.api.main.field.types import (
    FieldConditionalParameterSection,
    FieldDepartmentSection,
    FieldDescriptionSection,
    FieldFlagConfig,
    FieldFlagSection,
    FieldInternalData,
    FieldNameSection,
    FieldWebsocketEntries,
    FieldWebsocketResources,
    GetFieldApiRequest,
    GetFieldApiResponse,
    GetFieldWebsocketResponse,
)
from app.routes.v5.api.permissions import (
    has_tools_for_resource,
    resolve_agents_for_artifact,
)
from app.routes.v5.tools.entries.field_drafts.get import (
    get_field_drafts_entries_internal,
)
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.resources.agents.get import get_agents_internal
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.departments.search import search_departments_internal
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.descriptions.search import (
    search_descriptions_internal,
)
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags_internal
from app.routes.v5.tools.resources.models.get import get_models_internal
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names_internal
from app.routes.v5.tools.resources.parameters.get import get_parameters_internal
from app.routes.v5.tools.resources.parameters.search import search_parameters_internal
from app.routes.v5.tools.resources.profiles.get import get_profiles_internal
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.tools.get import get_tools
from app.sql.types import (
    GetFieldAccessSqlParams,
    GetFieldAccessSqlRow,
    GetFieldIdsSqlParams,
    GetFieldIdsSqlRow,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

QUERY1_SQL_PATH = "app/sql/queries/fields/get_field_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/fields/get_field_ids_complete.sql"

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


async def get_field_internal(
    profile_id: UUID,
    field_id: UUID | None,
    draft_id: UUID | None = None,
    description_search: str | None = None,
    conditional_parameter_search: str | None = None,
    conditional_parameter_show_selected: bool | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> FieldInternalData:
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_field_drafts_entries_internal(
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
        access_result = cast(
            GetFieldAccessSqlRow,
            await execute_sql_typed(
                conn,
                QUERY1_SQL_PATH,
                params=GetFieldAccessSqlParams(
                    profile_id=profile_id,
                    field_id=field_id,
                    draft_id=draft_id,
                    draft_group_id=draft_item.group_id
                    if draft_item is not None
                    else None,
                    draft_version=draft_item.version
                    if draft_item is not None
                    else None,
                ),
            ),
        )

        field_department_ids = access_result.field_department_ids or []

        if field_id is not None:
            if access_result.field_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Field {field_id} not found"
                )
            if not has_access(user_role, user_department_ids, field_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this field. It may be restricted to other departments.",
                )

        # === GROUP ID: Use provided group_id, or fall back to SQL-created one ===
        if group_id:
            effective_group_id = group_id
        else:
            effective_group_id = access_result.group_id
        effective_draft_version = access_result.effective_draft_version

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
        if draft_item.conditional_parameter_ids:
            selected_conditional_parameter_ids = draft_item.conditional_parameter_ids

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, FIELD_RESOURCES
    )

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

    can_edit = compute_can_edit(
        user_role=user_role,
        field_department_ids=field_department_ids,
        user_department_ids=user_department_ids,
    )
    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        field_department_ids=field_department_ids,
        user_department_ids=user_department_ids,
    )

    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []

    async def fetch_names():
        async with pool.acquire() as c:
            return (
                await get_names(
                    c, name_ids, get_redis_client(), bypass_cache=bypass_cache
                ),
                await search_names_internal(
                    c,
                    None,
                    20,
                    0,
                    effective_group_id,
                    None,
                    name_ids,
                    bypass_cache,
                    field=True,
                ),
            )

    async def fetch_descriptions():
        async with pool.acquire() as c:
            return (
                await get_descriptions(c, description_ids, get_redis_client(), cache),
                await search_descriptions_internal(
                    c,
                    description_search,
                    20,
                    0,
                    effective_group_id,
                    "recent",
                    description_ids,
                    bypass_cache,
                    field=True,
                ),
            )

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags(c, flag_ids, get_redis_client(), bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache,
                field=True,
            )
            suggestions = [f for f in all_flags if f.name == "field_active"]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            return (
                await get_departments(                    c, selected_department_ids, get_redis_client(), bypass_cache=bypass_cache                ),
                await search_departments_internal(
                    c,
                    search=None,
                    limit_count=20,
                    offset_count=0,
                    department_ids=user_department_ids,
                    suggest_source="all",
                    exclude_ids=selected_department_ids,
                    cache=cache,
                    field=True,
                ),
            )

    async def fetch_conditional_parameters():
        async with pool.acquire() as c:
            exclude_ids = (
                []
                if (conditional_parameter_show_selected or False)
                else selected_conditional_parameter_ids
            )
            return (
                await get_parameters_internal(
                    c, selected_conditional_parameter_ids, bypass_cache
                ),
                await search_parameters_internal(
                    c,
                    search=conditional_parameter_search,
                    limit_count=20,
                    offset_count=0,
                    persona_parameter=None,
                    document_parameter=None,
                    scenario_parameter=None,
                    video_parameter=None,
                    suggest_source="all",
                    exclude_ids=exclude_ids,
                    bypass_cache=bypass_cache,
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

    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
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
        raise HTTPException(
            status_code=400, detail="No accessible departments found for user"
        )

    # Fetch config resources for websocket generation context (from settings agents).
    config_agent_resource_ids = [a.id for a in settings_data.settings_agents if a.id]
    config_model_resource_ids = [
        a.model_id for a in settings_data.settings_agents if a.model_id
    ]

    config_agents: list[Any] = []
    config_models: list[Any] = []
    config_providers: list[Any] = []
    config_tools: list[Any] = []
    if config_agent_resource_ids:
        async with pool.acquire() as config_conn:
            config_agents = await get_agents_internal(
                config_conn, config_agent_resource_ids, bypass_cache
            )
    if config_model_resource_ids:
        async with pool.acquire() as config_conn:
            config_models = await get_models_internal(
                config_conn, config_model_resource_ids, bypass_cache
            )
            provider_ids = list(
                {
                    model.provider_id
                    for model in config_models
                    if model.provider_id is not None
                }
            )
            if provider_ids:
                config_providers = await get_providers(                    config_conn, provider_ids, get_redis_client(), bypass_cache=bypass_cache                )
    tool_ids: list[UUID] = []
    for agent in config_agents:
        raw = getattr(agent, "tool_ids", None) or []
        tool_ids.extend([tid for tid in raw if tid is not None])
    tool_ids = list(dict.fromkeys(tool_ids))
    if tool_ids:
        async with pool.acquire() as config_conn:
            config_tools = await get_tools(
                config_conn, tool_ids, get_redis_client(), bypass_cache=bypass_cache
            )

    return FieldInternalData(
        actor_name=actor_name,
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
    # Search/filter kwargs (from artifact tool calls)
    description_search: str | None = None,
    conditional_parameter_search: str | None = None,
    conditional_parameter_show_selected: bool | None = None,
) -> GetFieldWebsocketResponse:
    data = await get_field_internal(
        profile_id=profile_id,
        field_id=field_id,
        draft_id=draft_id,
        description_search=description_search,
        conditional_parameter_search=conditional_parameter_search,
        conditional_parameter_show_selected=conditional_parameter_show_selected,
        cache=cache,
    )

    # Fetch draft, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_field_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            return draft_items[0] if draft_items else None

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn, [profile_id], cache)

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

    async def fetch_tools():
        if not data.config_agents or not pool:
            return []
        agent_resource = data.config_agents[0]
        if not agent_resource or not agent_resource.tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools(
                c,
                list(agent_resource.tool_ids),
                get_redis_client(),
                bypass_cache=bypass_cache,
            )

    (
        draft_field,
        config_profile_result,
        runs_result,
        tools_result,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    # Build entries (always construct — both fields optional now)
    entries = FieldWebsocketEntries(
        draft_field=draft_field,
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

    websocket_resources = FieldWebsocketResources(
        names=data.selected_names,
        descriptions=data.selected_descriptions,
        flags=data.selected_flags,
        departments=data.selected_departments,
        conditional_parameters=data.selected_conditional_parameters,
    )

    return GetFieldWebsocketResponse(
        entries=entries if draft_field or runs_result else None,
        resources=websocket_resources,
        agents=data.config_agents,
        models=data.config_models,
        providers=data.config_providers,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetFieldApiRequest(
            field_id=field_id,
            draft_id=draft_id,
            description_search=description_search,
            conditional_parameter_search=conditional_parameter_search,
            conditional_parameter_show_selected=conditional_parameter_show_selected,
        ),
        resource_agent_ids=data.agent_ids,
        group_id=data.group_id,
    )


async def get_field_client(
    profile_id: UUID,
    field_id: UUID | None,
    draft_id: UUID | None = None,
    description_search: str | None = None,
    conditional_parameter_search: str | None = None,
    conditional_parameter_show_selected: bool | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetFieldApiResponse:
    data = await get_field_internal(
        profile_id=profile_id,
        field_id=field_id,
        draft_id=draft_id,
        description_search=description_search,
        conditional_parameter_search=conditional_parameter_search,
        conditional_parameter_show_selected=conditional_parameter_show_selected,
        cache=cache,
        group_id=group_id,
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


@router.post("/get", response_model=GetFieldApiResponse)
async def get_field(
    request: GetFieldApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFieldApiResponse:
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401, detail="Profile ID is required. Please sign in again."
            )

        response_data = await get_field_client(
            profile_id=profile_id,
            field_id=request.field_id,
            draft_id=request.draft_id,
            description_search=request.description_search,
            conditional_parameter_search=request.conditional_parameter_search,
            conditional_parameter_show_selected=request.conditional_parameter_show_selected,
            bypass_cache=bypass_cache,
            group_id=request.group_id,
        )

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


from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

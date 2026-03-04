"""Tool get endpoint - three-layer artifact architecture."""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool, get_redis_client
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.tool.permissions import (
    TOOL_RESOURCES,
    compute_args_outputs_required,
    compute_args_required,
    compute_can_edit,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_show_arg_positions,
    compute_show_args,
    compute_show_args_outputs,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    has_access,
)
from app.routes.v5.api.main.tool.types import (
    GetToolApiRequest,
    GetToolApiResponse,
    GetToolWebsocketResponse,
    ToolArgOutputSection,
    ToolArgPositionSection,
    ToolArgSection,
    ToolDescriptionSection,
    ToolFlagConfig,
    ToolFlagSection,
    ToolInternalData,
    ToolNameSection,
    ToolResourceBucket,
    ToolResources,
    ToolWebsocketEntries,
    ToolWebsocketResources,
)
from app.routes.v5.api.permissions import (
    has_tools_for_resource,
    resolve_agents_for_artifact,
)
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.entries.tool_drafts.get import get_tool_drafts_entries_internal
from app.routes.v5.tools.resources.agents.get import get_agents_internal
from app.routes.v5.tools.resources.arg_positions.get import get_arg_positions_internal
from app.routes.v5.tools.resources.arg_positions.search import (
    search_arg_positions_internal,
)
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args.search import search_args_internal
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.args_outputs.search import (
    search_args_outputs_internal,
)
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.descriptions.search import (
    search_descriptions_internal,
)
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags_internal
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names_internal
from app.routes.v5.tools.resources.profiles.get import get_profiles
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.tools.get import get_tools
from app.sql.types import (
    GetToolAccessSqlParams,
    GetToolAccessSqlRow,
    GetToolIdsSqlParams,
    GetToolIdsSqlRow,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

QUERY1_SQL_PATH = "app/sql/queries/tools/get_tool_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/tools/get_tool_ids_complete.sql"

router = APIRouter()


async def get_tool_internal(
    profile_id: UUID,
    tool_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> ToolInternalData:
    """Core data-fetching layer shared by websocket/client presenters."""

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

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_tool_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        access_result = cast(
            GetToolAccessSqlRow,
            await execute_sql_typed(
                conn,
                QUERY1_SQL_PATH,
                params=GetToolAccessSqlParams(
                    profile_id=profile_id,
                    tool_id=tool_id,
                    draft_id=draft_id,
                    draft_group_id=group_id
                    or (draft_item.group_id if draft_item is not None else None),
                    draft_version=draft_item.version
                    if draft_item is not None
                    else None,
                ),
            ),
        )

        # Extract artifact-specific state from Query 1 (no user context)
        active_usage_count = access_result.active_usage_count or 0

        if tool_id is not None:
            if access_result.tool_exists is False:
                raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")
            if not has_access(user_role):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this tool.",
                )

        # group_id is guaranteed by SQL (created inline if no draft)
        effective_group_id = group_id or access_result.group_id
        effective_draft_version = access_result.effective_draft_version

        ids_result = cast(
            GetToolIdsSqlRow,
            await execute_sql_typed(
                conn,
                QUERY2_SQL_PATH,
                params=GetToolIdsSqlParams(
                    profile_id=profile_id,
                    tool_id=tool_id,
                    draft_id=draft_id,
                    group_id=effective_group_id,
                    user_department_ids=[],
                ),
            ),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_args_ids = ids_result.args_ids or []
    selected_arg_position_ids = ids_result.arg_position_ids or []
    selected_args_outputs_ids = ids_result.args_outputs_ids or []

    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.args_ids:
            selected_args_ids = draft_item.args_ids
        draft_arg_position_ids = getattr(draft_item, "arg_position_ids", None)
        if draft_arg_position_ids:
            selected_arg_position_ids = draft_arg_position_ids
        if draft_item.args_output_ids:
            selected_args_outputs_ids = draft_item.args_output_ids

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, TOOL_RESOURCES
    )

    show_ai_generate_map = {
        resource: agent_ids.get(resource) is not None for resource in TOOL_RESOURCES
    }

    can_edit = compute_can_edit(
        user_role=user_role, active_usage_count=active_usage_count
    )
    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        active_usage_count=active_usage_count,
    )

    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []

    tool_flag_names = {"tool_active"}

    async def fetch_names() -> tuple[list[Any], list[Any]]:
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
                tool=True,
            )
            return selected, suggestions

    async def fetch_descriptions() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_descriptions(c, description_ids, get_redis_client(), cache)
            suggestions = await search_descriptions_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                description_ids,
                bypass_cache,
                tool=True,
            )
            return selected, suggestions

    async def fetch_args() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_args(
                c, selected_args_ids, get_redis_client(), bypass_cache=bypass_cache
            )
            suggestions = await search_args_internal(
                c,
                None,
                20,
                0,
                None,
                "linked",
                selected_args_ids,
                bypass_cache,
                tool=True,
            )
            return selected, suggestions

    async def fetch_arg_positions() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_arg_positions_internal(
                c,
                selected_arg_position_ids,
                bypass_cache,
            )
            suggestions = await search_arg_positions_internal(
                c,
                args_ids=selected_args_ids,
                limit_count=100,
                offset_count=0,
                exclude_ids=selected_arg_position_ids,
                cache=cache,
                tool=True,
            )
            return selected, suggestions

    async def fetch_args_outputs() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_args_outputs(
                c,
                selected_args_outputs_ids,
                bypass_cache,
            )
            suggestions = await search_args_outputs_internal(
                c,
                None,
                20,
                0,
                None,
                "linked",
                selected_args_outputs_ids,
                bypass_cache,
                tool=True,
            )
            return selected, suggestions

    async def fetch_flags() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_flags(c, flag_ids, get_redis_client(), cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache,
                tool=True,
            )
            suggestions = [f for f in all_flags if f.name in tool_flag_names]
            return selected, suggestions

    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (args_selected, args_suggestions),
        (arg_positions_selected, arg_positions_suggestions),
        (args_outputs_selected, args_outputs_suggestions),
        (flags_selected, flags_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_args(),
        fetch_arg_positions(),
        fetch_args_outputs(),
        fetch_flags(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    args_list = _dedupe_by_id(args_selected + args_suggestions, "id")
    arg_positions = _dedupe_by_id(
        arg_positions_selected + arg_positions_suggestions,
        "id",
    )
    args_outputs_list = _dedupe_by_id(
        args_outputs_selected + args_outputs_suggestions,
        "id",
    )
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")

    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)

    arg_position_value_by_args_id = {
        ap.args_id: ap.value for ap in arg_positions if ap.args_id is not None
    }

    def _args_sort_key(arg: Any) -> tuple[int, str]:
        if arg.id in arg_position_value_by_args_id:
            return (arg_position_value_by_args_id[arg.id], arg.name or "")
        return (10_000, arg.name or "")

    args_list = sorted(args_list, key=_args_sort_key)
    args_current = sorted(
        [a for a in args_list if a.id in selected_args_ids],
        key=_args_sort_key,
    )
    arg_positions_current = [
        ap for ap in arg_positions if ap.id in selected_arg_position_ids
    ]
    args_outputs_current = [
        ao for ao in args_outputs_list if ao.id in selected_args_outputs_ids
    ]

    show_flags_map = {
        "names": compute_show_name(
            has_tools_for_resource(settings_data.agent_tool_entries, "names")
        ),
        "descriptions": compute_show_description(),
        "flags": compute_show_flag(),
        "args": compute_show_args(len(args_list)),
        "arg_positions": compute_show_arg_positions(len(arg_positions), len(args_list)),
        "args_outputs": compute_show_args_outputs(len(args_outputs_list)),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "args": compute_args_required(),
        "arg_positions": False,
        "args_outputs": compute_args_outputs_required(),
    }

    tool_flags = [
        ToolFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flags_map["flags"],
            required=required_flags_map["flags"],
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
    ]

    suggestions_map: dict[str, list[UUID]] = {
        "names": [n.id for n in names_suggestions],
        "descriptions": [d.id for d in descriptions_suggestions],
        "args": [a.id for a in args_suggestions],
        "arg_positions": [ap.id for ap in arg_positions_suggestions],
        "args_outputs": [ao.id for ao in args_outputs_suggestions],
    }

    resources_payload = ToolResources(
        resources=ToolResourceBucket(
            names=names,
            descriptions=descriptions,
            args=args_list,
            arg_positions=arg_positions,
            args_outputs=args_outputs_list,
            flags=tool_flags,
        ),
        current=ToolResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            args=args_current,
            arg_positions=arg_positions_current,
            args_outputs=args_outputs_current,
            flags=[flag_resource] if flag_resource else [],
        ),
    )

    # Fetch config resources for websocket generation context (from settings agents).
    config_agent_ids = [a.id for a in settings_data.settings_agents if a.id]
    config_model_ids = [a.model_id for a in settings_data.settings_agents if a.model_id]

    config_agent_resources: list[Any] = []
    config_model_resources: list[Any] = []
    config_provider_resources: list[Any] = []
    if config_agent_ids:
        async with pool.acquire() as c:
            config_agent_resources = await get_agents_internal(
                c, config_agent_ids, cache
            )
    if config_model_ids:
        async with pool.acquire() as c:
            config_model_resources = await get_models_internal(
                c, config_model_ids, bypass_cache
            )
        provider_ids = list(
            {
                model.provider_id
                for model in config_model_resources
                if getattr(model, "provider_id", None) is not None
            }
        )
        if provider_ids:
            async with pool.acquire() as c:
                config_provider_resources = await get_providers(                    c, provider_ids, get_redis_client(), bypass_cache=bypass_cache                )

    return ToolInternalData(
        actor_name=actor_name,
        tool_exists=access_result.tool_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        agent_ids=agent_ids,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        resources_payload=resources_payload,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        config_agent_resources=config_agent_resources or None,
        config_model_resources=config_model_resources or None,
        config_provider_resources=config_provider_resources or None,
    )


async def get_tool_websocket(
    profile_id: UUID,
    tool_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetToolWebsocketResponse:
    """Minimal websocket response: views/resources/resource_agent_ids/group_id."""

    data = await get_tool_internal(
        profile_id=profile_id,
        tool_id=tool_id,
        draft_id=draft_id,
        cache=cache,
    )

    # Fetch draft tool view, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_tool_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                cache=cache,
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
        if not data.config_agent_resources or not pool:
            return []
        agent_resource = data.config_agent_resources[0]
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
        draft_tool,
        config_profile_result,
        runs_result,
        tools_result,
    ) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
        fetch_tools(),
    )

    current = data.resources_payload.current
    selected_flag_ids = {
        (getattr(flag, "flag_option_id", None) or getattr(flag, "id", None))
        for flag in (current.flags if current else []) or []
    }
    all_enriched_flags = (
        data.resources_payload.resources.flags
        if data.resources_payload.resources
        else []
    ) or []
    selected_enriched_flags = [
        f for f in all_enriched_flags if f.flag_option_id in selected_flag_ids
    ]

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_args = None
    config_args_outputs = None
    if tools_result and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in tools_result:
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
    entries = ToolWebsocketEntries(
        draft_tool=draft_tool,
        runs=runs_result,
    )

    return GetToolWebsocketResponse(
        entries=entries if draft_tool or runs_result else None,
        resources=ToolWebsocketResources(
            names=current.names if current else None,
            descriptions=current.descriptions if current else None,
            flags=selected_enriched_flags or None,
            args=current.args if current else None,
            arg_positions=current.arg_positions if current else None,
            args_outputs=current.args_outputs if current else None,
        ),
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetToolApiRequest(tool_id=tool_id, draft_id=draft_id),
        resource_agent_ids=data.agent_ids,
        group_id=data.group_id,
    )


async def get_tool_client(
    profile_id: UUID,
    tool_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetToolApiResponse:
    """BFF response for frontend with section-first resource contracts."""

    data = await get_tool_internal(
        profile_id=profile_id,
        tool_id=tool_id,
        draft_id=draft_id,
        cache=cache,
        group_id=group_id,
    )

    all_resources = data.resources_payload.resources
    current = data.resources_payload.current

    def _section_common(resource_key: str) -> dict[str, Any]:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "create_tool_id": data.create_tool_ids_map.get(resource_key),
            "link_tool_id": data.link_tool_ids_map.get(resource_key),
        }

    return GetToolApiResponse(
        actor_name=data.actor_name,
        tool_exists=data.tool_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=any(
            data.show_ai_generate_map.get(r, False)
            for r in ("names", "descriptions", "flags")
        ),
        args_show_ai_generate=data.show_ai_generate_map.get("args", False),
        arg_positions_show_ai_generate=data.show_ai_generate_map.get(
            "arg_positions",
            False,
        ),
        args_outputs_show_ai_generate=data.show_ai_generate_map.get(
            "args_outputs",
            False,
        ),
        names=ToolNameSection(
            **_section_common("names"),
            resource=current.names[0] if current and current.names else None,
            resources=all_resources.names if all_resources else [],
        ),
        descriptions=ToolDescriptionSection(
            **_section_common("descriptions"),
            resource=current.descriptions[0]
            if current and current.descriptions
            else None,
            resources=all_resources.descriptions if all_resources else [],
        ),
        flags=ToolFlagSection(
            **_section_common("flags"),
            current=current.flags[0] if current and current.flags else None,
            resources=all_resources.flags if all_resources else [],
        ),
        args=ToolArgSection(
            **_section_common("args"),
            current=current.args if current else [],
            resources=all_resources.args if all_resources else [],
        ),
        arg_positions=ToolArgPositionSection(
            **_section_common("arg_positions"),
            current=current.arg_positions if current else [],
            resources=all_resources.arg_positions if all_resources else [],
        ),
        args_outputs=ToolArgOutputSection(
            **_section_common("args_outputs"),
            current=current.args_outputs if current else [],
            resources=all_resources.args_outputs if all_resources else [],
        ),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("tool_", "")
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


@router.post("/get", response_model=GetToolApiResponse)
async def get_tool(
    request: GetToolApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetToolApiResponse:
    """Get tool information via section-first BFF response."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)

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
            group_id=request.group_id,
        )

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


from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

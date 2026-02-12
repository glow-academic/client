"""Tool get endpoint - three-layer artifact architecture."""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.tool.permissions import (
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
from app.api.v4.artifacts.tool.types import (
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
    ToolWebsocketResources,
    ToolWebsocketViews,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.arg_positions.get import get_arg_positions_internal
from app.api.v4.resources.arg_positions.search import search_arg_positions_internal
from app.api.v4.resources.args.get import get_args_internal
from app.api.v4.resources.args.search import search_args_internal
from app.api.v4.resources.args_outputs.get import get_args_outputs_internal
from app.api.v4.resources.args_outputs.search import search_args_outputs_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_tool_internal
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

QUERY1_SQL_PATH = "app/sql/v4/queries/tools/get_tool_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/tools/get_tool_ids_complete.sql"

router = APIRouter()


async def get_tool_internal(
    profile_id: UUID,
    tool_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ToolInternalData:
    """Core data-fetching layer shared by websocket/client presenters."""

    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Resolve shared profile context first (default path).
    async with pool.acquire() as context_conn:
        resolved_context = await get_profile_context_internal(
            conn=context_conn,
            profile_id=profile_id,
            department_id_cookie=None,
            bypass_cache=bypass_cache,
        )

    # Extract user context from internal fetch (single source of truth)
    user_role = resolved_context.user_role
    actor_name = resolved_context.actor_name

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_tool_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
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
        if draft_item.args_outputs_ids:
            selected_args_outputs_ids = draft_item.args_outputs_ids

    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=TOOL_RESOURCES,
        resources_needed=list(TOOL_RESOURCES),
        user_department_ids=None,
        require_mcp=False,
    )

    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}
    for resource in TOOL_RESOURCES:
        selected_agent_id = agent_ids.get(resource)
        if not selected_agent_id:
            continue
        for candidate in candidate_agents:
            if candidate.agent_id == selected_agent_id:
                create_tool_ids_map[resource] = candidate.create_tool_ids.get(resource)
                link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                break

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
            return selected, suggestions

    async def fetch_descriptions() -> tuple[list[Any], list[Any]]:
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
            return selected, suggestions

    async def fetch_args() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_args_internal(c, selected_args_ids, bypass_cache)
            suggestions = await search_args_internal(
                c,
                None,
                20,
                0,
                None,
                "linked",
                selected_args_ids,
                bypass_cache,
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
                bypass_cache=bypass_cache,
            )
            return selected, suggestions

    async def fetch_args_outputs() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_args_outputs_internal(
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
            )
            return selected, suggestions

    async def fetch_flags() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache,
                artifact_type="tool",
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
        "names": compute_show_name(ids_result.names_has_tools or False),
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

    selected_agent_ids = list({a for a in agent_ids.values() if a is not None})

    config_agent_resources = []
    config_model_resources = []
    config_provider_resources = []
    if selected_agent_ids:
        async with pool.acquire() as c:
            config_agent_resources = await get_agents_internal(
                c,
                selected_agent_ids,
                bypass_cache,
            )

        model_ids = list(
            {
                agent.model_id
                for agent in config_agent_resources
                if getattr(agent, "model_id", None) is not None
            }
        )
        if model_ids:
            async with pool.acquire() as c:
                config_model_resources = await get_models_internal(
                    c,
                    model_ids,
                    bypass_cache,
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
                config_provider_resources = await get_providers_internal(
                    c,
                    provider_ids,
                    bypass_cache,
                )

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
        bypass_cache=bypass_cache,
    )

    pool = get_pool()
    draft_tool = None
    if draft_id and pool:
        async with pool.acquire() as conn:
            draft_items = await get_draft_tool_internal(
                conn=conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_tool = draft_items[0]

    config_tools = []
    if data.config_agent_resources:
        config_tool_ids = {
            tid
            for agent in data.config_agent_resources
            for tid in (agent.tool_ids or [])
            if tid is not None
        }
        if config_tool_ids and pool:
            async with pool.acquire() as conn:
                config_tools = await get_tools_internal(
                    conn,
                    list(config_tool_ids),
                    bypass_cache,
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

    return GetToolWebsocketResponse(
        views=ToolWebsocketViews(draft_tool=draft_tool) if draft_tool else None,
        resources=ToolWebsocketResources(
            names=current.names if current else None,
            descriptions=current.descriptions if current else None,
            flags=selected_enriched_flags or None,
            args=current.args if current else None,
            arg_positions=current.arg_positions if current else None,
            args_outputs=current.args_outputs if current else None,
            agents=data.config_agent_resources,
            models=data.config_model_resources,
            providers=data.config_provider_resources,
            tools=config_tools or None,
        ),
        resource_agent_ids=data.agent_ids,
        group_id=data.group_id,
    )


async def get_tool_client(
    profile_id: UUID,
    tool_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetToolApiResponse:
    """BFF response for frontend with section-first resource contracts."""

    data = await get_tool_internal(
        profile_id=profile_id,
        tool_id=tool_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
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
    """Get tool information via section-first BFF response."""
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

        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = (
                response_data.names.resource.name
                if response_data.names and response_data.names.resource
                else None
            )
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

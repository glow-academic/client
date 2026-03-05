"""Auth get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_auth_internal() - Core data fetching (cacheable, returns dataclass)
2. get_auth_websocket() - Minimal data for WebSocket handlers
3. get_auth_client() - Full BFF response for HTTP endpoint/frontend
"""

import asyncio
from dataclasses import dataclass
from datetime import UTC
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool, get_redis_client
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.auth.permissions import (
    AUTH_RESOURCES,
    compute_can_edit,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_protocols_required,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_protocols,
    compute_show_slugs,
    compute_slugs_required,
)
from app.routes.v5.api.main.auth.types import (
    AuthDescriptionSection,
    AuthFlagConfig,
    AuthFlagSection,
    AuthItemResource,
    AuthItemSection,
    AuthNameSection,
    AuthProtocolSection,
    AuthSlugSection,
    AuthWebsocketEntries,
    AuthWebsocketResources,
    GetAuthApiRequest,
    GetAuthApiResponse,
    GetAuthWebsocketResponse,
)
from app.routes.v5.api.permissions import (
    has_tools_for_resource,
    resolve_agents_for_artifact,
)
from app.routes.v5.tools.entries.auth_drafts.get import get_auth_drafts_entries_internal
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.descriptions.search import (
    search_descriptions_internal,
)
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags_internal
from app.routes.v5.tools.resources.items.get import get_items
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.profiles.get import get_profiles
from app.routes.v5.tools.resources.protocols.get import get_protocols
from app.routes.v5.tools.resources.protocols.search import search_protocols_internal
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.slugs.get import get_slugs
from app.routes.v5.tools.resources.slugs.search import search_slugs_internal
from app.routes.v5.tools.resources.tools.get import get_tools
from app.sql.types import (
    GetAuthAccessSqlParams,
    GetAuthAccessSqlRow,
    GetAuthIdsSqlParams,
    GetAuthIdsSqlRow,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/queries/auth/get_auth_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/auth/get_auth_ids_complete.sql"

router = APIRouter()


@dataclass
class AuthInternalData:
    actor_name: str | None
    auth_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None
    draft_view: Any | None

    # Agent mappings (resource_type -> agent_id)
    resource_agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool

    # Resources
    names: list[Any]
    descriptions: list[Any]
    flags: list[AuthFlagConfig]
    protocols: list[Any]
    slugs: list[Any]
    items: list[AuthItemResource]

    names_current: list[Any]
    descriptions_current: list[Any]
    flags_current: list[AuthFlagConfig]
    protocols_current: list[Any]
    slugs_current: list[Any]

    # Config resources for websocket generation context
    config_agents: list[Any]
    config_models: list[Any]
    config_providers: list[Any]
    config_tools: list[Any]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_auth_internal(
    profile_id: UUID,
    auth_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> AuthInternalData:
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    # Resolve shared profile context first (default path)
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
            draft_items = await get_auth_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        access_result = cast(
            GetAuthAccessSqlRow,
            await execute_sql_typed(
                conn,
                QUERY1_SQL_PATH,
                params=GetAuthAccessSqlParams(
                    profile_id=profile_id,
                    auth_id=auth_id,
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

        if auth_id is not None and access_result.auth_exists is False:
            raise HTTPException(status_code=404, detail=f"Auth {auth_id} not found")

        # group_id is guaranteed by SQL (created inline if no draft)
        if group_id:
            effective_group_id = group_id
        else:
            effective_group_id = access_result.group_id
        effective_draft_version = access_result.effective_draft_version

        ids_result = cast(
            GetAuthIdsSqlRow,
            await execute_sql_typed(
                conn,
                QUERY2_SQL_PATH,
                params=GetAuthIdsSqlParams(
                    profile_id=profile_id,
                    auth_id=auth_id,
                    draft_id=draft_id,
                    group_id=effective_group_id,
                    user_department_ids=user_department_ids,
                ),
            ),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_protocol_ids = ids_result.protocol_ids or []
    selected_slug_ids = ids_result.slug_ids or []
    auth_item_ids = ids_result.auth_item_ids or []

    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.protocol_ids:
            selected_protocol_ids = draft_item.protocol_ids
        if draft_item.slug_ids:
            selected_slug_ids = draft_item.slug_ids

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    resource_agent_ids, create_tool_ids_map, link_tool_ids_map = (
        resolve_agents_for_artifact(settings_data.agent_tool_entries, AUTH_RESOURCES)
    )

    # Derive has_tools flags from settings
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")
    protocols_has_tools = has_tools_for_resource(
        settings_data.agent_tool_entries, "protocols"
    )
    slugs_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "slugs")

    def compute_show_ai_generate(resource: str) -> bool:
        return resource_agent_ids.get(resource) is not None

    show_ai_generate_map = {
        "names": compute_show_ai_generate("names"),
        "descriptions": compute_show_ai_generate("descriptions"),
        "flags": compute_show_ai_generate("flags"),
        "protocols": compute_show_ai_generate("protocols"),
        "slugs": compute_show_ai_generate("slugs"),
    }
    basic_show_ai_generate = any(
        [
            show_ai_generate_map["names"],
            show_ai_generate_map["descriptions"],
            show_ai_generate_map["flags"],
        ]
    )

    can_edit = compute_can_edit(user_role=user_role)
    disabled_reason = compute_disabled_reason(user_role=user_role)

    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []

    async def fetch_names() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_names(
                c, name_ids, get_redis_client(), bypass_cache=bypass_cache
            )
            suggestions = await search_names(
                c,
                get_redis_client(),
                draft_id=effective_group_id,
                exclude_ids=name_ids,
                bypass_cache=bypass_cache,
                auth=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_descriptions(
                c, description_ids, get_redis_client(), cache
            )
            suggestions = await search_descriptions_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                description_ids,
                bypass_cache,
                auth=True,
            )
            return (selected, suggestions)

    AUTH_FLAG_NAMES = {"auth_active"}

    async def fetch_flags() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_flags(c, flag_ids, get_redis_client(), bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache,
                auth=True,
            )
            suggestions = [f for f in all_flags if f.name in AUTH_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_protocols() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_protocols(
                c, selected_protocol_ids, get_redis_client(), bypass_cache
            )
            suggestions = await search_protocols_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                selected_protocol_ids,
                bypass_cache,
                auth=True,
            )
            return (selected, suggestions)

    async def fetch_slugs() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_slugs(
                c, selected_slug_ids, get_redis_client(), bypass_cache
            )
            suggestions = await search_slugs_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                selected_slug_ids,
                bypass_cache,
                auth=True,
            )
            return (selected, suggestions)

    async def fetch_items() -> list[AuthItemResource]:
        if not auth_item_ids:
            return []
        async with pool.acquire() as c:
            items = await get_items(c, auth_item_ids, get_redis_client(), bypass_cache)
            return [
                AuthItemResource(
                    auth_item_id=item.id,
                    name=item.name,
                    description=item.description,
                    position=item.position,
                    active=True,
                    value_masked=None,
                    key_id=None,
                    encrypted=item.encrypted,
                    generated=item.generated,
                )
                for item in items
            ]

    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (protocols_selected, protocols_suggestions),
        (slugs_selected, slugs_suggestions),
        items,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_protocols(),
        fetch_slugs(),
        fetch_items(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    flags_raw = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    protocols = _dedupe_by_id(protocols_selected + protocols_suggestions, "id")
    slugs = _dedupe_by_id(slugs_selected + slugs_suggestions, "id")

    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    protocols_current = [p for p in protocols if p.id in selected_protocol_ids]
    slugs_current = [s for s in slugs if s.id in selected_slug_ids]

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
        "descriptions": compute_show_description(),
        "flags": compute_show_flag(),
        "protocols": compute_show_protocols(protocols_has_tools, len(protocols)),
        "slugs": compute_show_slugs(slugs_has_tools, len(slugs)),
        "items": True,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "protocols": compute_protocols_required(show_flags_map["protocols"]),
        "slugs": compute_slugs_required(show_flags_map["slugs"]),
        "items": False,
    }

    suggestions_map: dict[str, list[UUID]] = {
        "names": [n.id for n in names_suggestions if n.id],
        "descriptions": [d.id for d in descriptions_suggestions if d.id],
        "protocols": [p.id for p in protocols_suggestions if p.id],
        "slugs": [s.id for s in slugs_suggestions if s.id],
        "items": [],
    }

    auth_flags = [
        AuthFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flags_map["flags"],
            required=required_flags_map["flags"],
            generated=flag.generated,
        )
        for flag in flags_raw
        if flag.id
    ]

    selected_flag_config = (
        [
            cfg
            for cfg in auth_flags
            if cfg.flag_option_id is not None
            and cfg.flag_option_id == selected_active_flag_id
        ]
        if selected_active_flag_id
        else []
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
        async with pool.acquire() as c:
            config_agents = await get_agents(
                c, config_agent_resource_ids, get_redis_client(), cache=cache
            )
    if config_model_resource_ids:
        async with pool.acquire() as c:
            config_models = await get_models(
                c,
                config_model_resource_ids,
                get_redis_client(),
                bypass_cache=bypass_cache,
            )
        provider_ids = list(
            dict.fromkeys(
                [m.provider_id for m in config_models if m.provider_id is not None]
            )
        )
        if provider_ids:
            async with pool.acquire() as c:
                config_providers = await get_providers(
                    c, provider_ids, get_redis_client(), bypass_cache=bypass_cache
                )
    tool_ids: list[UUID] = []
    for agent in config_agents:
        raw = getattr(agent, "tool_ids", None) or []
        tool_ids.extend([tid for tid in raw if tid is not None])
    tool_ids = list(dict.fromkeys(tool_ids))
    if tool_ids:
        async with pool.acquire() as c:
            config_tools = await get_tools(
                c, tool_ids, get_redis_client(), bypass_cache=bypass_cache
            )

    return AuthInternalData(
        actor_name=actor_name,
        auth_exists=access_result.auth_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        draft_view=draft_item,
        resource_agent_ids=resource_agent_ids,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map={
            **show_ai_generate_map,
            "items": compute_show_ai_generate("items"),
        },
        basic_show_ai_generate=basic_show_ai_generate,
        names=names,
        descriptions=descriptions,
        flags=auth_flags,
        protocols=protocols,
        slugs=slugs,
        items=items,
        names_current=[name_resource] if name_resource else [],
        descriptions_current=[description_resource] if description_resource else [],
        flags_current=selected_flag_config,
        protocols_current=protocols_current,
        slugs_current=slugs_current,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_auth_websocket(
    profile_id: UUID,
    auth_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetAuthWebsocketResponse:
    """Minimal response for websocket handlers."""
    pool = get_pool()

    async def fetch_data():
        return await get_auth_internal(
            profile_id=profile_id,
            auth_id=auth_id,
            draft_id=draft_id,
            cache=cache,
        )

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await get_profiles(conn, [profile_id], get_redis_client(), cache)

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

    (
        data,
        config_profile_result,
        runs_result,
    ) = await asyncio.gather(
        fetch_data(),
        fetch_config_profile(),
        fetch_runs_today(),
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    tools = data.config_tools
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

    entries = AuthWebsocketEntries(
        draft_auth=data.draft_view,
        runs=runs_result,
    )

    return GetAuthWebsocketResponse(
        entries=entries if data.draft_view or runs_result else None,
        resources=AuthWebsocketResources(
            names=data.names_current,
            descriptions=data.descriptions_current,
            flags=data.flags_current,
            protocols=data.protocols_current,
            slugs=data.slugs_current,
            items=data.items,
        ),
        agents=data.config_agents,
        models=data.config_models,
        providers=data.config_providers,
        tools=data.config_tools,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetAuthApiRequest(auth_id=auth_id, draft_id=draft_id),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def get_auth_client(
    profile_id: UUID,
    auth_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetAuthApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_auth_internal(
        profile_id=profile_id,
        auth_id=auth_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
        group_id=group_id,
    )

    return GetAuthApiResponse(
        actor_name=data.actor_name,
        auth_exists=data.auth_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        names=AuthNameSection(
            show=data.show_flags_map.get("names", False),
            required=data.required_flags_map.get("names", False),
            suggestions=data.suggestions_map.get("names"),
            show_ai_generate=data.show_ai_generate_map.get("names", False),
            create_tool_id=data.create_tool_ids_map.get("names"),
            link_tool_id=data.link_tool_ids_map.get("names"),
            resource=data.names_current[0] if data.names_current else None,
            resources=data.names,
        ),
        descriptions=AuthDescriptionSection(
            show=data.show_flags_map.get("descriptions", False),
            required=data.required_flags_map.get("descriptions", False),
            suggestions=data.suggestions_map.get("descriptions"),
            show_ai_generate=data.show_ai_generate_map.get("descriptions", False),
            create_tool_id=data.create_tool_ids_map.get("descriptions"),
            link_tool_id=data.link_tool_ids_map.get("descriptions"),
            resource=data.descriptions_current[0]
            if data.descriptions_current
            else None,
            resources=data.descriptions,
        ),
        flags=AuthFlagSection(
            show=data.show_flags_map.get("flags", False),
            required=data.required_flags_map.get("flags", False),
            suggestions=data.suggestions_map.get("flags"),
            show_ai_generate=data.show_ai_generate_map.get("flags", False),
            create_tool_id=data.create_tool_ids_map.get("flags"),
            link_tool_id=data.link_tool_ids_map.get("flags"),
            current=data.flags_current,
            resources=data.flags,
        ),
        protocols=AuthProtocolSection(
            show=data.show_flags_map.get("protocols", False),
            required=data.required_flags_map.get("protocols", False),
            suggestions=data.suggestions_map.get("protocols"),
            show_ai_generate=data.show_ai_generate_map.get("protocols", False),
            create_tool_id=data.create_tool_ids_map.get("protocols"),
            link_tool_id=data.link_tool_ids_map.get("protocols"),
            current=data.protocols_current,
            resources=data.protocols,
        ),
        slugs=AuthSlugSection(
            show=data.show_flags_map.get("slugs", False),
            required=data.required_flags_map.get("slugs", False),
            suggestions=data.suggestions_map.get("slugs"),
            show_ai_generate=data.show_ai_generate_map.get("slugs", False),
            create_tool_id=data.create_tool_ids_map.get("slugs"),
            link_tool_id=data.link_tool_ids_map.get("slugs"),
            current=data.slugs_current,
            resources=data.slugs,
        ),
        items=AuthItemSection(
            show=data.show_flags_map.get("items", True),
            required=data.required_flags_map.get("items", False),
            suggestions=[],
            show_ai_generate=data.show_ai_generate_map.get("items", False),
            create_tool_id=data.create_tool_ids_map.get("items"),
            link_tool_id=data.link_tool_ids_map.get("items"),
            current=data.items,
            resources=data.items,
        ),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("auth_", "")
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


@router.post("/get", response_model=GetAuthApiResponse)
async def get_auth(
    request: GetAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthApiResponse:
    """Get auth information using two-pass architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_auth_client(
            profile_id=profile_id,
            auth_id=request.auth_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            group_id=request.group_id,
        )

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth",
            sql_query=None,
            sql_params=(request.auth_id, request.draft_id),
            request=http_request,
        )


from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

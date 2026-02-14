"""Auth get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_auth_internal() - Core data fetching (cacheable, returns dataclass)
2. get_auth_websocket() - Minimal data for WebSocket handlers
3. get_auth_client() - Full BFF response for HTTP endpoint/frontend
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.auth.permissions import (
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
from app.api.v4.artifacts.auth.types import (
    AuthDescriptionSection,
    AuthFlagConfig,
    AuthFlagSection,
    AuthItemResource,
    AuthItemSection,
    AuthNameSection,
    AuthProtocolSection,
    AuthSlugSection,
    AuthWebsocketResources,
    AuthWebsocketViews,
    GetAuthApiRequest,
    GetAuthApiResponse,
    GetAuthWebsocketResponse,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.items.get import get_items_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.protocols.get import get_protocols_internal
from app.api.v4.resources.protocols.search import search_protocols_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.slugs.get import get_slugs_internal
from app.api.v4.resources.slugs.search import search_slugs_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_auth_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetAuthAccessSqlParams,
    GetAuthAccessSqlRow,
    GetAuthIdsSqlParams,
    GetAuthIdsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/auth/get_auth_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/auth/get_auth_ids_complete.sql"

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
            draft_items = await get_draft_auth_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
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
                    draft_group_id=draft_item.group_id if draft_item is not None else None,
                    draft_version=draft_item.version if draft_item is not None else None,
                ),
            ),
        )

        if auth_id is not None and access_result.auth_exists is False:
            raise HTTPException(status_code=404, detail=f"Auth {auth_id} not found")

        # group_id is guaranteed by SQL (created inline if no draft)
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

    names_has_tools = ids_result.names_has_tools or False
    protocols_has_tools = ids_result.protocols_has_tools or False
    slugs_has_tools = ids_result.slugs_has_tools or False

    # Agent scoring
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resource_agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=AUTH_RESOURCES,
        resources_needed=list(AUTH_RESOURCES),
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}
    for resource in AUTH_RESOURCES:
        selected_agent_id = resource_agent_ids.get(resource)
        if not selected_agent_id:
            continue
        for candidate in candidate_agents:
            if candidate.agent_id == selected_agent_id:
                create_tool_ids_map[resource] = candidate.create_tool_ids.get(resource)
                link_tool_ids_map[resource] = candidate.link_tool_ids.get(resource)
                break

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
                auth=True,
            )
            return (selected, suggestions)

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
                auth=True,
            )
            return (selected, suggestions)

    AUTH_FLAG_NAMES = {"auth_active"}

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
                auth=True,
            )
            suggestions = [f for f in all_flags if f.name in AUTH_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_protocols() -> tuple[list[Any], list[Any]]:
        async with pool.acquire() as c:
            selected = await get_protocols_internal(
                c, selected_protocol_ids, bypass_cache
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
            selected = await get_slugs_internal(c, selected_slug_ids, bypass_cache)
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
            items = await get_items_internal(c, auth_item_ids, bypass_cache)
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

    selected_agent_ids = [aid for aid in resource_agent_ids.values() if aid is not None]
    selected_agent_ids = list(dict.fromkeys(selected_agent_ids))
    config_agents: list[Any] = []
    config_models: list[Any] = []
    config_providers: list[Any] = []
    config_tools: list[Any] = []
    if selected_agent_ids:
        async with pool.acquire() as c:
            config_agents = await get_agents_internal(
                c,
                selected_agent_ids,
                bypass_cache=bypass_cache,
            )

        model_ids = list(
            dict.fromkeys([a.model_id for a in config_agents if a.model_id is not None])
        )
        if model_ids:
            async with pool.acquire() as c:
                config_models = await get_models_internal(
                    c,
                    model_ids,
                    bypass_cache=bypass_cache,
                )

        provider_ids = list(
            dict.fromkeys(
                [m.provider_id for m in config_models if m.provider_id is not None]
            )
        )
        if provider_ids:
            async with pool.acquire() as c:
                config_providers = await get_providers_internal(
                    c,
                    provider_ids,
                    bypass_cache=bypass_cache,
                )

        tool_ids: list[UUID] = []
        for agent in config_agents:
            raw = getattr(agent, "tool_ids", None) or []
            tool_ids.extend([tid for tid in raw if tid is not None])
        tool_ids = list(dict.fromkeys(tool_ids))
        if tool_ids:
            async with pool.acquire() as c:
                config_tools = await get_tools_internal(
                    c,
                    tool_ids,
                    bypass_cache=bypass_cache,
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
    data = await get_auth_internal(
        profile_id=profile_id,
        auth_id=auth_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetAuthWebsocketResponse(
        views=AuthWebsocketViews(draft_auth=data.draft_view),
        resources=AuthWebsocketResources(
            names=data.names_current,
            descriptions=data.descriptions_current,
            flags=data.flags_current,
            protocols=data.protocols_current,
            slugs=data.slugs_current,
            items=data.items,
            agents=data.config_agents,
            models=data.config_models,
            providers=data.config_providers,
            tools=data.config_tools,
        ),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def get_auth_client(
    profile_id: UUID,
    auth_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetAuthApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_auth_internal(
        profile_id=profile_id,
        auth_id=auth_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
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


@router.post(
    "/get",
    response_model=GetAuthApiResponse,
    dependencies=[
        audit_activity(
            "auth.get",
            "{{ actor.name }} {% if auth %}viewed{% else %}opened new{% endif %} auth{% if auth %} '{{ auth.name }}'{% endif %}",
        )
    ],
)
async def get_auth(
    request: GetAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthApiResponse:
    """Get auth information using two-pass architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

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
            if request.auth_id and current_name:
                audit_ctx["auth"] = {
                    "name": current_name,
                    "id": str(request.auth_id),
                }
            audit_set(http_request, **audit_ctx)

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

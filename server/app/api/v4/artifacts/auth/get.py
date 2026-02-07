"""Auth get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_auth_internal() - Core data fetching (cacheable, returns dataclass)
2. get_auth_websocket() - Minimal data for WebSocket handlers
3. get_auth_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.auth.permissions import (
    AUTH_RESOURCES,
    build_domain_data,
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
    AuthFlagConfig,
    AuthItemData,
    AuthResourceBucket,
    AuthResources,
    DomainAgent,
    GetAuthApiRequest,
    GetAuthApiResponse,
    GetAuthWebsocketResponse,
)
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.protocols.get import get_protocols_internal
from app.api.v4.resources.protocols.search import search_protocols_internal
from app.api.v4.resources.slugs.get import get_slugs_internal
from app.api.v4.resources.slugs.search import search_slugs_internal
from app.api.v4.types import CandidateAgent
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetAuthAccessSqlParams,
    GetAuthAccessSqlRow,
    GetAuthIdsSqlParams,
    GetAuthIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/auth/get_auth_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/auth/get_auth_ids_complete.sql"

router = APIRouter()


@dataclass
class AuthInternalData:
    """Internal data from core auth fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_auth_websocket() - minimal data for WebSocket handlers
    - get_auth_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    auth_exists: bool | None
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

    # Show AI generate flags (computed: domain_id exists AND agent exists)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool

    # Domain data for modals
    domain_data_list: list[Any]  # list[DomainData]

    # Resources payload
    resources_payload: AuthResources

    # Per-resource group IDs
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Auth items (special junction)
    auth_items: list[AuthItemData]


async def get_auth_internal(
    profile_id: UUID,
    auth_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> AuthInternalData:
    """Core data fetching layer (cacheable).

    Fetches all auth data using two-pass architecture and returns
    a dataclass with all computed values. This is the shared layer used by:
    - get_auth_websocket() - minimal data for WebSocket handlers
    - get_auth_client() - full BFF response for HTTP/frontend
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    async with pool.acquire() as conn:
        query1_params = GetAuthAccessSqlParams(
            profile_id=profile_id,
            auth_id=auth_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetAuthAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []

        # Early validation: check auth exists
        if auth_id is not None:
            if access_result.auth_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Auth {auth_id} not found",
                )

        effective_group_id = access_result.group_id
        effective_draft_version = access_result.draft_version

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetAuthIdsSqlParams(
            profile_id=profile_id,
            auth_id=auth_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetAuthIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # Extract selected IDs from Query 2
    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_protocol_ids = ids_result.protocol_ids or []
    selected_slug_ids = ids_result.slug_ids or []
    auth_item_ids = ids_result.auth_item_ids or []

    # Get tools existence flags from Query 2 (used for show_* UI flags)
    names_has_tools = ids_result.names_has_tools or False
    protocols_has_tools = ids_result.protocols_has_tools or False
    slugs_has_tools = ids_result.slugs_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(AUTH_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=AUTH_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in AUTH_RESOURCES:
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
        "protocols": ids_result.protocols_domain_id,
        "slugs": ids_result.slugs_domain_id,
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        """Returns True if domain_id exists AND agent exists for that resource."""
        domain_id = domain_ids_map.get(resource)
        agent_id_val = agent_ids.get(resource)
        return domain_id is not None and agent_id_val is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    protocols_show_ai_generate = compute_show_ai_generate("protocols")
    slugs_show_ai_generate = compute_show_ai_generate("slugs")

    # Step-level show_ai_generate flag
    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
        ]
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(user_role=user_role)
    disabled_reason = compute_disabled_reason(user_role=user_role)

    # === PASS 2: Parallel Resource Fetching ===

    # Selected IDs for fetching
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    protocol_ids = selected_protocol_ids
    slug_ids = selected_slug_ids

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

    AUTH_FLAG_NAMES = {"auth_active"}

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
                artifact_type="auth",
            )
            # Filter to only auth-specific flags
            suggestions = [f for f in all_flags if f.name in AUTH_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_protocols():
        async with pool.acquire() as c:
            selected = await get_protocols_internal(c, protocol_ids, bypass_cache)
            suggestions = await search_protocols_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                protocol_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_slugs():
        async with pool.acquire() as c:
            selected = await get_slugs_internal(c, slug_ids, bypass_cache)
            suggestions = await search_slugs_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                slug_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_auth_items():
        """Fetch auth items from items_resource using IDs from Q2."""
        if not auth_item_ids:
            return []
        async with pool.acquire() as c:
            # Direct SQL query for auth items
            items_sql = """
                SELECT
                    i.id as auth_item_id,
                    i.name,
                    i.description,
                    i.position,
                    i.active,
                    CASE
                        WHEN i.encrypted THEN '••••••••'
                        ELSE i.name
                    END as value_masked,
                    NULL::uuid as key_id,
                    i.encrypted
                FROM items_resource i
                WHERE i.id = ANY($1::uuid[])
                ORDER BY i.position
            """
            rows = await c.fetch(items_sql, auth_item_ids)
            return [
                AuthItemData(
                    auth_item_id=row["auth_item_id"],
                    name=row["name"],
                    description=row["description"],
                    position=row["position"],
                    active=row["active"],
                    value_masked=row["value_masked"],
                    key_id=row["key_id"],
                    encrypted=row["encrypted"],
                )
                for row in rows
            ]

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (protocols_selected, protocols_suggestions),
        (slugs_selected, slugs_suggestions),
        auth_items,
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_protocols(),
        fetch_slugs(),
        fetch_auth_items(),
    )

    # Dedupe resources
    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    protocols = _dedupe_by_id(protocols_selected + protocols_suggestions, "id")
    slugs = _dedupe_by_id(slugs_selected + slugs_suggestions, "id")

    # Find selected resources
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)
    protocol_resources = [p for p in protocols if p.id in selected_protocol_ids]
    slug_resources = [s for s in slugs if s.id in selected_slug_ids]

    # Build suggestion ID lists
    name_suggestions = [n.id for n in names_suggestions]
    description_suggestions = [d.id for d in descriptions_suggestions]
    protocol_suggestions_ids = [p.id for p in protocols_suggestions]
    slug_suggestions_ids = [s.id for s in slugs_suggestions]

    # Compute show flags
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_protocols_flag = compute_show_protocols(protocols_has_tools, len(protocols))
    show_slugs_flag = compute_show_slugs(slugs_has_tools, len(slugs))

    # Build show and required flags maps
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "protocols": show_protocols_flag,
        "slugs": show_slugs_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "protocols": compute_protocols_required(show_protocols_flag),
        "slugs": compute_slugs_required(show_slugs_flag),
    }

    # Build rich domain metadata for client display
    domain_data_list = build_domain_data(
        domain_ids_map, show_flags_map, required_flags_map
    )

    # Transform flags to enriched format for client
    auth_flags = [
        AuthFlagConfig(
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

    # === Construct Response ===
    resources_payload = AuthResources(
        resources=AuthResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=auth_flags,
            protocols=protocols,
            slugs=slugs,
        ),
        current=AuthResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=[flag_resource] if flag_resource else [],
            protocols=protocol_resources or [],
            slugs=slug_resources or [],
        ),
    )

    # Build domains list for WebSocket handler
    domains_list: list[DomainAgent] = []
    # Per-resource group IDs (not from drafts view for auth — set to None)
    resource_group_ids: dict[str, UUID | None] = {
        "names": None,
        "descriptions": None,
        "flags": None,
        "protocols": None,
        "slugs": None,
    }
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
        "protocols": protocols_show_ai_generate,
        "slugs": slugs_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions,
        "descriptions": description_suggestions,
        "protocols": protocol_suggestions_ids,
        "slugs": slug_suggestions_ids,
    }

    return AuthInternalData(
        # Access/context
        actor_name=access_result.actor_name,
        auth_exists=access_result.auth_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        # Domain mappings
        domain_ids_map=domain_ids_map,
        agent_ids=agent_ids,
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
        # Auth items
        auth_items=auth_items,
    )


async def get_auth_websocket(
    profile_id: UUID,
    auth_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetAuthWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """
    data = await get_auth_internal(
        profile_id=profile_id,
        auth_id=auth_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetAuthWebsocketResponse(
        group_id=data.group_id,
        # Domain IDs for domain_to_resource mapping
        name_domain_id=data.domain_ids_map.get("names"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        protocols_domain_id=data.domain_ids_map.get("protocols"),
        slugs_domain_id=data.domain_ids_map.get("slugs"),
        # Domains mapping for agent lookup
        domains=data.domains_list,
        # Resources for Jinja context
        resources=data.resources_payload,
    )


async def get_auth_client(
    profile_id: UUID,
    auth_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetAuthApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full response with all UI fields, suggestions, and
    computed *_show_ai_generate flags. Does NOT include domains
    (agent lookup is server-side only).
    """
    data = await get_auth_internal(
        profile_id=profile_id,
        auth_id=auth_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetAuthApiResponse(
        # Required fields
        actor_name=data.actor_name,
        auth_exists=data.auth_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        # Per-resource group IDs
        names_group_id=data.resource_group_ids.get("names"),
        descriptions_group_id=data.resource_group_ids.get("descriptions"),
        flags_group_id=data.resource_group_ids.get("flags"),
        protocols_group_id=data.resource_group_ids.get("protocols"),
        slugs_group_id=data.resource_group_ids.get("slugs"),
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
        # Flag
        show_flag=data.show_flags_map.get("flags"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        flag_required=data.required_flags_map.get("flags"),
        flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        # Protocols
        show_protocols=data.show_flags_map.get("protocols"),
        protocols_domain_id=data.domain_ids_map.get("protocols"),
        protocols_required=data.required_flags_map.get("protocols"),
        protocol_suggestions=data.suggestions_map.get("protocols"),
        protocols_show_ai_generate=data.show_ai_generate_map.get("protocols"),
        # Slugs
        show_slugs=data.show_flags_map.get("slugs"),
        slugs_domain_id=data.domain_ids_map.get("slugs"),
        slugs_required=data.required_flags_map.get("slugs"),
        slug_suggestions=data.suggestions_map.get("slugs"),
        slugs_show_ai_generate=data.show_ai_generate_map.get("slugs"),
        # Step-level AI generation flags
        basic_show_ai_generate=data.basic_show_ai_generate,
        # Per-resource CREATE tool IDs
        name_create_tool_id=data.create_tool_ids_map.get("names"),
        description_create_tool_id=data.create_tool_ids_map.get("descriptions"),
        protocols_create_tool_id=data.create_tool_ids_map.get("protocols"),
        slugs_create_tool_id=data.create_tool_ids_map.get("slugs"),
        # Per-resource LINK tool IDs
        name_link_tool_id=data.link_tool_ids_map.get("names"),
        description_link_tool_id=data.link_tool_ids_map.get("descriptions"),
        flag_link_tool_id=data.link_tool_ids_map.get("flags"),
        protocols_link_tool_id=data.link_tool_ids_map.get("protocols"),
        slugs_link_tool_id=data.link_tool_ids_map.get("slugs"),
        # Domain metadata for client display in modals
        domain_data=data.domain_data_list,
        # Resources
        resources=data.resources_payload,
        # Auth items
        auth_items=data.auth_items,
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'auth_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("auth_", "")
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
    """Get auth information using two-pass architecture.

    Query 1: Access check (user role, auth state)
    Query 2: ID fetching (resource IDs, suggestions, agents)
    Pass 2: Parallel resource fetching (each resource type has own cache)
    """
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
            if request.auth_id and current_name:
                audit_ctx["auth"] = {
                    "name": current_name,
                    "id": str(request.auth_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "auth"
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
            operation="get_auth",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

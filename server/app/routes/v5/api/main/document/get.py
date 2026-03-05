"""Document get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_document_internal() - Core data fetching (cacheable, returns dataclass)
2. get_document_websocket() - Minimal data for WebSocket handlers
3. get_document_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool, get_redis_client
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.document.permissions import (
    DOCUMENT_RESOURCES,
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
    compute_show_uploads,
    compute_uploads_required,
    has_access,
)
from app.routes.v5.api.main.document.types import (
    DocumentDepartmentSection,
    DocumentDescriptionSection,
    DocumentFieldSection,
    DocumentFlagConfig,
    DocumentFlagSection,
    DocumentImageSection,
    DocumentNameSection,
    DocumentResourceBucket,
    DocumentResources,
    DocumentTextSection,
    DocumentUploadSection,
    DocumentWebsocketEntries,
    DocumentWebsocketResources,
    GetDocumentApiRequest,
    GetDocumentApiResponse,
    GetDocumentWebsocketResponse,
)
from app.routes.v5.api.permissions import (
    has_tools_for_resource,
    resolve_agents_for_artifact,
)
from app.routes.v5.tools.entries.document_drafts.get import (
    get_document_drafts_entries_internal,
)
from app.routes.v5.tools.entries.runs.search import get_run_list_entries_internal
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.descriptions.search import (
    search_descriptions,
)
from app.routes.v5.tools.resources.fields.search import search_fields
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.images.get import get_images
from app.routes.v5.tools.resources.images.search import search_images
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.parameter_fields.get import (
    get_parameter_fields,
)
from app.routes.v5.tools.resources.profiles.get import get_profiles
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.texts.get import get_texts
from app.routes.v5.tools.resources.texts.search import search_texts
from app.routes.v5.tools.resources.tools.get import get_tools
from app.routes.v5.tools.resources.uploads.get import get_uploads
from app.routes.v5.tools.resources.uploads.search import search_uploads
from app.sql.types import (
    GetDocumentAccessSqlParams,
    GetDocumentAccessSqlRow,
    GetDocumentIdsSqlParams,
    GetDocumentIdsSqlRow,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/queries/documents/get_document_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/queries/documents/get_document_ids_complete.sql"

router = APIRouter()


@dataclass
class DocumentInternalData:
    """Internal data from core document fetching (cacheable layer)."""

    # Access/context
    actor_name: str | None
    document_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    # Agent IDs (resource_type -> agent_id)
    agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags (computed: agent exists for that resource)
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    content_show_ai_generate: bool

    # Resources payload
    resources_payload: DocumentResources

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Config resources (for websocket generation)
    config_agent_resources: list[Any] | None
    config_model_resources: list[Any] | None
    config_provider_resources: list[Any] | None


async def get_document_internal(
    profile_id: UUID,
    document_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> DocumentInternalData:
    """Core data fetching layer (cacheable).

    Fetches all document data using two-pass architecture and returns
    a dataclass with all computed values.
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
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
            draft_items = await get_document_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetDocumentAccessSqlParams(
            profile_id=profile_id,
            document_id=document_id,
            draft_id=draft_id,
            draft_group_id=draft_item.group_id if draft_item is not None else None,
            draft_version=draft_item.version if draft_item is not None else None,
        )

        access_result = cast(
            GetDocumentAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract artifact-specific state from Query 1 (no user context)
        document_department_ids = access_result.document_department_ids or []
        active_scenario_count = access_result.active_scenario_count or 0

        # Early validation: check document exists
        if document_id is not None:
            if access_result.document_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Document {document_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, document_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this document. It may be restricted to other departments.",
                )

        # === GROUP ID: Use provided group_id, or fall back to SQL-created one ===
        if group_id:
            effective_group_id = group_id
        else:
            effective_group_id = access_result.group_id
        effective_draft_version = access_result.effective_draft_version

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetDocumentIdsSqlParams(
            profile_id=profile_id,
            document_id=document_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetDocumentIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id

    selected_department_ids = ids_result.department_ids or []
    selected_field_ids = ids_result.field_ids or []
    selected_upload_ids = ids_result.upload_ids or []
    selected_image_ids = ids_result.image_ids or []
    selected_text_ids = ids_result.text_ids or []

    # Draft values override canonical document-junction values.
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
        if draft_item.upload_ids:
            selected_upload_ids = draft_item.upload_ids
        if draft_item.image_ids:
            selected_image_ids = draft_item.image_ids
        if draft_item.text_ids:
            selected_text_ids = draft_item.text_ids

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, DOCUMENT_RESOURCES
    )

    # Derive has_tools flags from settings
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        """Returns True if agent exists for that resource."""
        agent_id = agent_ids.get(resource)
        return agent_id is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")
    fields_show_ai_generate = compute_show_ai_generate("fields")
    uploads_show_ai_generate = compute_show_ai_generate("uploads")
    images_show_ai_generate = compute_show_ai_generate("images")
    texts_show_ai_generate = compute_show_ai_generate("texts")

    # Step-level show_ai_generate flags
    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
            departments_show_ai_generate,
        ]
    )
    content_show_ai_generate = any(
        [
            fields_show_ai_generate,
            uploads_show_ai_generate,
            images_show_ai_generate,
            texts_show_ai_generate,
        ]
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        document_department_ids=document_department_ids,
        active_scenario_count=active_scenario_count,
        user_department_ids=user_department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        document_department_ids=document_department_ids,
        active_scenario_count=active_scenario_count,
        user_department_ids=user_department_ids,
    )

    # === PASS 2: Parallel Resource Fetching ===

    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    department_ids = selected_department_ids
    field_ids = selected_field_ids
    upload_ids = selected_upload_ids
    image_ids = selected_image_ids
    text_ids = selected_text_ids

    async def fetch_names():
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
                document=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions():
        async with pool.acquire() as c:
            selected = await get_descriptions(
                c, description_ids, get_redis_client(), cache
            )
            suggestions = await search_descriptions(
                c, get_redis_client(), draft_id=effective_group_id, exclude_ids=description_ids, bypass_cache=bypass_cache, document=True,
            )
            return (selected, suggestions)

    # Document-specific flag names (business logic)
    DOCUMENT_FLAG_NAMES = {"document_active"}

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags(c, flag_ids, get_redis_client(), bypass_cache)
            all_flags = await search_flags(
                c, get_redis_client(), search=None, limit_count=50,
                offset_count=0, exclude_ids=flag_ids,
                bypass_cache=bypass_cache, document=True,
            )
            # Filter to only document-specific flags
            suggestions = [f for f in all_flags if f.name in DOCUMENT_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments(
                c, department_ids, get_redis_client(), bypass_cache=bypass_cache
            )
            suggestions = await search_departments(
                c,
                get_redis_client(),
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=department_ids,
                bypass_cache=bypass_cache,
                document=True,
            )
            return (selected, suggestions)

    async def fetch_fields():
        async with pool.acquire() as c:
            selected = await get_parameter_fields(c, field_ids, get_redis_client(), bypass_cache)
            # Search for available fields scoped to user departments
            suggestions = await search_fields(
                c,
                get_redis_client(),
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=field_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_uploads():
        async with pool.acquire() as c:
            selected = await get_uploads(c, upload_ids, get_redis_client(), bypass_cache)
            suggestions = await search_uploads(
                c,
                get_redis_client(),
                search=None,
                limit_count=20,
                offset_count=0,
                exclude_ids=upload_ids,
                bypass_cache=bypass_cache,
                document=True,
            )
            return (selected, suggestions)

    async def fetch_images():
        async with pool.acquire() as c:
            selected = await get_images(c, image_ids, get_redis_client(), bypass_cache)
            suggestions = await search_images(
                c,
                get_redis_client(),
                search=None,
                limit_count=20,
                offset_count=0,
                exclude_ids=image_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_texts():
        async with pool.acquire() as c:
            selected = await get_texts(c, text_ids, get_redis_client(), bypass_cache)
            suggestions = await search_texts(
                c,
                get_redis_client(),
                search=None,
                limit_count=20,
                offset_count=0,
                exclude_ids=text_ids,
                bypass_cache=bypass_cache,
            )
            return (selected, suggestions)

    # Parallel fetch all resources
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (fields_selected, fields_suggestions),
        (uploads_selected, uploads_suggestions),
        (images_selected, images_suggestions),
        (texts_selected, texts_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_fields(),
        fetch_uploads(),
        fetch_images(),
        fetch_texts(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "id"
    )
    fields = _dedupe_by_id(fields_selected, "field_id")
    uploads = _dedupe_by_id(uploads_selected + uploads_suggestions, "id")
    images = _dedupe_by_id(images_selected + images_suggestions, "id")
    texts = _dedupe_by_id(texts_selected + texts_suggestions, "id")

    # Find selected resources
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)

    department_resources = [
        d for d in departments if d.id in selected_department_ids
    ]
    field_resources = [f for f in fields if f.field_id in selected_field_ids]
    upload_resources = [u for u in uploads if u.id in selected_upload_ids]
    image_resources = [i for i in images if i.id in selected_image_ids]
    text_resources = [t for t in texts if t.id in selected_text_ids]

    name_suggestions = [n.id for n in names_suggestions]
    description_suggestions = [d.id for d in descriptions_suggestions]
    department_suggestions = [d.id for d in departments_suggestions]
    field_suggestions = [f.id for f in fields_suggestions]
    upload_suggestions = [u.id for u in uploads_suggestions]
    image_suggestions = [i.id for i in images_suggestions]
    text_suggestions = [t.id for t in texts_suggestions]

    # Compute final show flags based on actual data
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_fields_flag = compute_show_fields(len(fields))
    show_uploads_flag = compute_show_uploads()
    show_images_flag = True
    show_texts_flag = True

    # Build show and required flags maps
    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "fields": show_fields_flag,
        "uploads": show_uploads_flag,
        "images": show_images_flag,
        "texts": show_texts_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "fields": compute_fields_required(),
        "uploads": compute_uploads_required(),
        "images": False,
        "texts": False,
    }

    # Transform flags to enriched format for client
    document_flags = [
        DocumentFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            flag_option_id=flag.id,
            show=show_flag,
            required=compute_flag_required(),
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
    ]

    # Validation for new mode
    if document_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Detail mode: check access via name_resource
    if document_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this document. It may be restricted to other departments.",
        )

    # === Construct Response ===
    resources_payload = DocumentResources(
        resources=DocumentResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=document_flags,
            departments=departments,
            fields=fields,
            uploads=uploads,
            images=images,
            texts=texts,
        ),
        current=DocumentResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=[flag_resource] if flag_resource else [],
            departments=department_resources or [],
            fields=field_resources or [],
            uploads=upload_resources or [],
            images=image_resources or [],
            texts=text_resources or [],
        ),
    )

    # Build show_ai_generate map
    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "descriptions": description_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
        "fields": fields_show_ai_generate,
        "uploads": uploads_show_ai_generate,
        "images": images_show_ai_generate,
        "texts": texts_show_ai_generate,
    }

    # Build suggestions map
    suggestions_map = {
        "names": name_suggestions,
        "descriptions": description_suggestions,
        "departments": department_suggestions,
        "fields": field_suggestions,
        "uploads": upload_suggestions,
        "images": image_suggestions,
        "texts": text_suggestions,
    }

    # Fetch config resources for websocket generation context (from settings agents).
    config_agent_resource_ids = [a.id for a in settings_data.settings_agents if a.id]
    config_model_resource_ids = [
        a.model_id for a in settings_data.settings_agents if a.model_id
    ]

    config_agents_result: list[Any] = []
    config_models_result: list[Any] = []
    config_providers_result: list[Any] = []
    if config_agent_resource_ids:
        async with pool.acquire() as c:
            config_agents_result = await get_agents(
                c, config_agent_resource_ids, get_redis_client(), bypass_cache
            )
    if config_model_resource_ids:
        async with pool.acquire() as c:
            config_models_result = await get_models(
                c, config_model_resource_ids, get_redis_client(), bypass_cache
            )
        provider_ids = list(
            dict.fromkeys(
                [
                    getattr(model, "provider_id", None)
                    for model in config_models_result
                    if getattr(model, "provider_id", None) is not None
                ]
            )
        )
        if provider_ids:
            async with pool.acquire() as c:
                config_providers_result = await get_providers(
                    c, provider_ids, get_redis_client(), bypass_cache=bypass_cache
                )

    return DocumentInternalData(
        # Access/context
        actor_name=actor_name,
        document_exists=access_result.document_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        # Agent IDs
        agent_ids=agent_ids,
        # Show/required flags
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        # Suggestions
        suggestions_map=suggestions_map,
        # Show AI generate
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        content_show_ai_generate=content_show_ai_generate,
        # Resources
        resources_payload=resources_payload,
        # Per-resource tool IDs
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        # Config resources
        config_agent_resources=config_agents_result or None,
        config_model_resources=config_models_result or None,
        config_provider_resources=config_providers_result or None,
    )


async def get_document_websocket(
    profile_id: UUID,
    document_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetDocumentWebsocketResponse:
    """Minimal response for WebSocket handlers.

    Returns resource_agent_ids, views, and flat resources for generation.
    """
    data = await get_document_internal(
        profile_id=profile_id,
        document_id=document_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # Fetch draft, config_profile, runs_today, and tools in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_document_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            return draft_items[0] if draft_items else None

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await get_profiles(
                conn, [profile_id], get_redis_client(), bypass_cache
            )

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
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            ids = getattr(agent, "tool_ids", None) or []
            tool_ids.extend(ids)
        deduped_tool_ids = list(dict.fromkeys(tool_ids))
        if not deduped_tool_ids:
            return []
        async with pool.acquire() as conn:
            return await get_tools(
                conn, deduped_tool_ids, get_redis_client(), bypass_cache=bypass_cache
            )

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

    current = data.resources_payload.current

    # Get enriched flag configs for selected flags
    selected_flag_ids = {
        getattr(f, "flag_option_id", None) or getattr(f, "id", None)
        for f in (current.flags if current and current.flags else [])
    } - {None}
    all_enriched_flags = (
        data.resources_payload.resources.flags
        if data.resources_payload.resources
        else []
    ) or []
    selected_enriched_flags = [
        f for f in all_enriched_flags if f.flag_option_id in selected_flag_ids
    ]

    # Build views (always construct — both fields optional now)
    entries = DocumentWebsocketEntries(
        draft_document=draft_view,
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

    websocket_resources = DocumentWebsocketResources(
        names=current.names if current else None,
        descriptions=current.descriptions if current else None,
        flags=selected_enriched_flags or None,
        departments=current.departments if current else None,
        fields=current.fields if current else None,
        uploads=current.uploads if current else None,
        images=current.images if current else None,
        texts=current.texts if current else None,
    )

    return GetDocumentWebsocketResponse(
        group_id=data.group_id,
        entries=entries if draft_view or runs_result else None,
        resource_agent_ids=data.agent_ids,
        resources=websocket_resources,
        agents=data.config_agent_resources,
        models=data.config_model_resources,
        providers=data.config_provider_resources,
        tools=tools_result or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=config_profile_result or None,
        params=GetDocumentApiRequest(document_id=document_id, draft_id=draft_id),
    )


async def get_document_client(
    profile_id: UUID,
    document_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
    group_id: UUID | None = None,
) -> GetDocumentApiResponse:
    """BFF response for HTTP endpoint/frontend.

    Returns the full section-first response with all UI fields, suggestions, and
    computed *_show_ai_generate flags.
    """
    data = await get_document_internal(
        profile_id=profile_id,
        document_id=document_id,
        draft_id=draft_id,
        cache=cache,
        group_id=group_id,
    )

    resources_bucket = data.resources_payload.resources
    current_bucket = data.resources_payload.current

    def section_common(resource_key: str) -> dict[str, Any]:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key, []),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "create_tool_id": data.create_tool_ids_map.get(resource_key),
            "link_tool_id": data.link_tool_ids_map.get(resource_key),
        }

    return GetDocumentApiResponse(
        actor_name=data.actor_name,
        document_exists=data.document_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        content_show_ai_generate=data.content_show_ai_generate,
        names=DocumentNameSection(
            resource=(
                current_bucket.names[0]
                if current_bucket and current_bucket.names
                else None
            ),
            resources=(resources_bucket.names if resources_bucket else None),
            **section_common("names"),
        ),
        descriptions=DocumentDescriptionSection(
            resource=(
                current_bucket.descriptions[0]
                if current_bucket and current_bucket.descriptions
                else None
            ),
            resources=(resources_bucket.descriptions if resources_bucket else None),
            **section_common("descriptions"),
        ),
        flags=DocumentFlagSection(
            current=(current_bucket.flags if current_bucket else None),
            resources=(resources_bucket.flags if resources_bucket else None),
            **section_common("flags"),
        ),
        departments=DocumentDepartmentSection(
            current=(current_bucket.departments if current_bucket else None),
            resources=(resources_bucket.departments if resources_bucket else None),
            **section_common("departments"),
        ),
        fields=DocumentFieldSection(
            current=(current_bucket.fields if current_bucket else None),
            resources=(resources_bucket.fields if resources_bucket else None),
            **section_common("fields"),
        ),
        uploads=DocumentUploadSection(
            current=(current_bucket.uploads if current_bucket else None),
            resources=(resources_bucket.uploads if resources_bucket else None),
            **section_common("uploads"),
        ),
        images=DocumentImageSection(
            current=(current_bucket.images if current_bucket else None),
            resources=(resources_bucket.images if resources_bucket else None),
            **section_common("images"),
        ),
        texts=DocumentTextSection(
            current=(current_bucket.texts if current_bucket else None),
            resources=(resources_bucket.texts if resources_bucket else None),
            **section_common("texts"),
        ),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'document_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    # Remove artifact prefix (e.g., 'document_active' -> 'active')
    key = name.replace("document_", "")
    # Title case for label
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


@router.post("/get", response_model=GetDocumentApiResponse)
async def get_document(
    request: GetDocumentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDocumentApiResponse:
    """Get document information using two-pass architecture."""
    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Call the client (BFF) function
        response_data = await get_document_client(
            profile_id=profile_id,
            document_id=request.document_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
            group_id=request.group_id,
        )

        # No global cache for this response - individual resources are cached
        response.headers["X-Cache-Tags"] = "documents"
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
            operation="get_document",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )


from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

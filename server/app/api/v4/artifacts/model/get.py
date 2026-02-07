"""Model get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_model_internal() - Core data fetching (cacheable, returns dataclass)
2. get_model_websocket() - Minimal data for WebSocket handlers
3. get_model_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.model.permissions import (
    MODEL_RESOURCES,
    build_domain_data,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_endpoint_required,
    compute_flag_required,
    compute_key_required,
    compute_modalities_required,
    compute_name_required,
    compute_pricing_required,
    compute_provider_required,
    compute_qualities_required,
    compute_reasoning_levels_required,
    compute_show_departments,
    compute_show_description,
    compute_show_endpoint,
    compute_show_flag,
    compute_show_key,
    compute_show_modalities,
    compute_show_name,
    compute_show_pricing,
    compute_show_provider,
    compute_show_qualities,
    compute_show_reasoning_levels,
    compute_show_temperature_levels,
    compute_show_value,
    compute_show_voices,
    compute_temperature_levels_required,
    compute_value_required,
    compute_voices_required,
    has_access,
)
from app.api.v4.artifacts.model.types import (
    DomainAgent,
    GetModelApiRequest,
    GetModelApiResponse,
    GetModelWebsocketResponse,
    ModelFlagConfig,
    ModelResourceBucket,
    ModelResources,
)
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.endpoints.get import get_endpoints_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.keys.get import get_keys_internal
from app.api.v4.resources.modalities.get import get_modalities_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.pricing.get import get_pricing_internal
from app.api.v4.resources.qualities.get import get_qualities_internal
from app.api.v4.resources.reasoning_levels.get import get_reasoning_levels_internal
from app.api.v4.resources.temperature_levels.get import get_temperature_levels_internal
from app.api.v4.resources.values.get import get_values_internal
from app.api.v4.resources.voices.get import get_voices_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_resources_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetModelAccessSqlParams,
    GetModelAccessSqlRow,
    GetModelIdsSqlParams,
    GetModelIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/models/get_model_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/models/get_model_ids_complete.sql"

router = APIRouter()


@dataclass
class ModelInternalData:
    """Internal data from core model fetching (cacheable layer).

    This dataclass contains all computed data needed by both:
    - get_model_websocket() - minimal data for WebSocket handlers
    - get_model_client() - full BFF response for HTTP/frontend
    """

    # Access/context
    actor_name: str | None
    model_exists: bool | None
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
    provider_show_ai_generate: bool
    features_show_ai_generate: bool

    # Domain data for modals
    domain_data_list: list[Any]  # list[DomainData]

    # Resources payload
    resources_payload: ModelResources

    # Per-resource group IDs (from draft MV)
    resource_group_ids: dict[str, UUID | None]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]


async def get_model_internal(
    profile_id: UUID,
    model_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ModelInternalData:
    """Core data fetching layer (cacheable).

    Fetches all model data using two-pass architecture and returns
    a dataclass with all computed values. This is the shared layer used by:
    - get_model_websocket() - minimal data for WebSocket handlers
    - get_model_client() - full BFF response for HTTP/frontend
    """

    # === QUERY 1: Access Check (always fresh, no cache) ===
    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_resources_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        query1_params = GetModelAccessSqlParams(
            profile_id=profile_id,
            model_id=model_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetModelAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract user context from Query 1
        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        model_department_ids = access_result.model_department_ids or []
        active_persona_count = access_result.active_persona_count or 0

        # Early validation: check model exists
        if model_id is not None:
            if access_result.model_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Model {model_id} not found",
                )

            # Check access
            if not has_access(user_role, user_department_ids, model_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "You don't have access to this model."
                        " It may be restricted to other departments."
                    ),
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

        # === QUERY 2: ID Fetching (using user_department_ids from Query 1) ===
        query2_params = GetModelIdsSqlParams(
            profile_id=profile_id,
            model_id=model_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetModelIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    # === EXTRACT SELECTED IDS FROM QUERY 2 ===
    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_value_id = ids_result.value_id
    selected_endpoint_id = ids_result.endpoint_id
    selected_key_id = ids_result.key_id

    selected_active_flag_id = ids_result.active_flag_id
    selected_modalities_enabled_flag_id = ids_result.modalities_enabled_flag_id
    selected_temperature_enabled_flag_id = ids_result.temperature_enabled_flag_id
    selected_pricing_enabled_flag_id = ids_result.pricing_enabled_flag_id
    selected_voices_enabled_flag_id = ids_result.voices_enabled_flag_id
    selected_reasoning_levels_enabled_flag_id = (
        ids_result.reasoning_levels_enabled_flag_id
    )
    selected_qualities_enabled_flag_id = ids_result.qualities_enabled_flag_id

    selected_department_ids = ids_result.department_ids or []
    selected_input_modality_ids = ids_result.input_modality_ids or []
    selected_output_modality_ids = ids_result.output_modality_ids or []
    selected_temperature_level_ids = ids_result.temperature_level_ids or []
    selected_pricing_ids = ids_result.pricing_ids or []
    selected_reasoning_level_ids = ids_result.reasoning_level_ids or []
    selected_quality_ids = ids_result.quality_ids or []
    selected_voice_ids = ids_result.voice_ids or []

    # Draft values override canonical model-junction values.
    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids

    # Build per-resource group_ids from draft_item
    resource_group_ids: dict[str, UUID | None] = {
        "names": draft_item.names_group_id if draft_item else None,
        "descriptions": draft_item.descriptions_group_id if draft_item else None,
        "values": None,  # Model-specific, not in generic draft view
        "endpoints": None,
        "providers": None,
        "keys": None,
        "flags": draft_item.flags_group_id if draft_item else None,
        "departments": draft_item.departments_group_id if draft_item else None,
        "modalities": None,
        "temperature_levels": None,
        "pricing": None,
        "reasoning_levels": None,
        "qualities": None,
        "voices": None,
    }

    # Get tools existence flags from Query 2
    names_has_tools = ids_result.names_has_tools or False
    values_has_tools = ids_result.values_has_tools or False
    endpoints_has_tools = ids_result.endpoints_has_tools or False

    # === PARSE CANDIDATE AGENTS FROM QUERY 2 AND COMPUTE AGENT IDS IN PYTHON ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)

    # Use Python scoring to select best agents for each resource
    user_dept_set = set(user_department_ids) if user_department_ids else None
    resources_needed = list(MODEL_RESOURCES)
    agent_ids = select_agents_for_artifact(
        candidates=candidate_agents,
        artifact_resources=MODEL_RESOURCES,
        resources_needed=resources_needed,
        user_department_ids=user_dept_set,
        require_mcp=False,
    )

    # === BUILD TOOL_IDS MAPS FROM SELECTED AGENTS ===
    create_tool_ids_map: dict[str, UUID | None] = {}
    link_tool_ids_map: dict[str, UUID | None] = {}

    for resource in MODEL_RESOURCES:
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
        "values": ids_result.value_domain_id,
        "endpoints": ids_result.endpoint_domain_id,
        "providers": ids_result.provider_domain_id,
        "keys": ids_result.key_domain_id,
        "flags": ids_result.flag_domain_id,
        "departments": ids_result.departments_domain_id,
        "modalities": ids_result.modalities_domain_id,
        "temperature_levels": ids_result.temperature_levels_domain_id,
        "pricing": ids_result.pricing_domain_id,
        "reasoning_levels": ids_result.reasoning_levels_domain_id,
        "qualities": ids_result.qualities_domain_id,
        "voices": ids_result.voices_domain_id,
    }

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def compute_show_ai_generate(resource: str) -> bool:
        domain_id = domain_ids_map.get(resource)
        agent_id = agent_ids.get(resource)
        return domain_id is not None and agent_id is not None

    show_ai_generate_map = {r: compute_show_ai_generate(r) for r in MODEL_RESOURCES}

    # Step-level show_ai_generate flags
    basic_show_ai_generate = any(
        [
            show_ai_generate_map.get("names", False),
            show_ai_generate_map.get("descriptions", False),
            show_ai_generate_map.get("flags", False),
            show_ai_generate_map.get("departments", False),
        ]
    )
    provider_show_ai_generate = any(
        [
            show_ai_generate_map.get("values", False),
            show_ai_generate_map.get("endpoints", False),
            show_ai_generate_map.get("providers", False),
            show_ai_generate_map.get("keys", False),
        ]
    )
    features_show_ai_generate = any(
        [
            show_ai_generate_map.get("modalities", False),
            show_ai_generate_map.get("temperature_levels", False),
            show_ai_generate_map.get("pricing", False),
            show_ai_generate_map.get("reasoning_levels", False),
            show_ai_generate_map.get("qualities", False),
            show_ai_generate_map.get("voices", False),
        ]
    )

    # === PYTHON BUSINESS LOGIC ===
    can_edit = compute_can_edit(
        user_role=user_role,
        model_department_ids=model_department_ids,
        active_persona_count=active_persona_count,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        model_department_ids=model_department_ids,
        active_persona_count=active_persona_count,
    )

    # === PASS 2: Parallel Resource Fetching ===

    # Selected IDs for fetching
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    value_ids_list = [selected_value_id] if selected_value_id else []
    endpoint_ids_list = [selected_endpoint_id] if selected_endpoint_id else []
    key_ids_list = [selected_key_id] if selected_key_id else []
    flag_ids = [
        fid
        for fid in [
            selected_active_flag_id,
            selected_modalities_enabled_flag_id,
            selected_temperature_enabled_flag_id,
            selected_pricing_enabled_flag_id,
            selected_voices_enabled_flag_id,
            selected_reasoning_levels_enabled_flag_id,
            selected_qualities_enabled_flag_id,
        ]
        if fid is not None
    ]
    department_ids = selected_department_ids
    input_modality_ids = selected_input_modality_ids
    output_modality_ids = selected_output_modality_ids
    all_modality_ids = list(set(input_modality_ids + output_modality_ids))
    temperature_level_ids = selected_temperature_level_ids
    pricing_ids_list = selected_pricing_ids
    reasoning_level_ids = selected_reasoning_level_ids
    quality_ids = selected_quality_ids
    voice_ids = selected_voice_ids

    # Parallel fetch all resources
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

    async def fetch_values():
        async with pool.acquire() as c:
            selected = await get_values_internal(c, value_ids_list, bypass_cache)
            # No search endpoint for values yet - return empty suggestions
            return (selected, [])

    async def fetch_endpoints():
        async with pool.acquire() as c:
            selected = await get_endpoints_internal(c, endpoint_ids_list, bypass_cache)
            return (selected, [])

    async def fetch_keys():
        async with pool.acquire() as c:
            selected = await get_keys_internal(c, key_ids_list, bypass_cache)
            return (selected, [])

    # Model-specific flag names (business logic)
    MODEL_FLAG_NAMES = {
        "model_active",
        "model_modalities_enabled",
        "model_temperature_enabled",
        "model_pricing_enabled",
        "model_voices_enabled",
        "model_reasoning_levels_enabled",
        "model_qualities_enabled",
    }

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
                artifact_type="model",
            )
            suggestions = [f for f in all_flags if f.name in MODEL_FLAG_NAMES]
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

    async def fetch_modalities():
        async with pool.acquire() as c:
            selected = await get_modalities_internal(c, all_modality_ids, bypass_cache)
            return (selected, [])

    async def fetch_qualities():
        async with pool.acquire() as c:
            selected = await get_qualities_internal(c, quality_ids, bypass_cache)
            return (selected, [])

    async def fetch_pricing():
        async with pool.acquire() as c:
            selected = await get_pricing_internal(c, pricing_ids_list, bypass_cache)
            return (selected, [])

    async def fetch_temperature_levels():
        async with pool.acquire() as c:
            selected = await get_temperature_levels_internal(
                c, temperature_level_ids, bypass_cache
            )
            return (selected, [])

    async def fetch_reasoning_levels():
        async with pool.acquire() as c:
            selected = await get_reasoning_levels_internal(
                c, reasoning_level_ids, bypass_cache
            )
            return (selected, [])

    async def fetch_voices():
        async with pool.acquire() as c:
            selected = await get_voices_internal(c, voice_ids, bypass_cache)
            return (selected, [])

    # Fetch all resources in parallel
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (values_selected, values_suggestions),
        (endpoints_selected, endpoints_suggestions),
        (keys_selected, keys_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (modalities_selected, modalities_suggestions),
        (qualities_selected, qualities_suggestions),
        (pricing_selected, pricing_suggestions),
        (temperature_levels_selected, temperature_levels_suggestions),
        (reasoning_levels_selected, reasoning_levels_suggestions),
        (voices_selected, voices_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_values(),
        fetch_endpoints(),
        fetch_keys(),
        fetch_flags(),
        fetch_departments(),
        fetch_modalities(),
        fetch_qualities(),
        fetch_pricing(),
        fetch_temperature_levels(),
        fetch_reasoning_levels(),
        fetch_voices(),
    )

    # Dedupe resources
    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    values = _dedupe_by_id(values_selected + values_suggestions, "id")
    endpoints_list = _dedupe_by_id(endpoints_selected + endpoints_suggestions, "id")
    keys = _dedupe_by_id(keys_selected + keys_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    modalities = _dedupe_by_id(modalities_selected + modalities_suggestions, "id")
    qualities = _dedupe_by_id(qualities_selected + qualities_suggestions, "id")
    pricing = _dedupe_by_id(pricing_selected + pricing_suggestions, "pricing_id")
    temperature_levels = _dedupe_by_id(
        temperature_levels_selected + temperature_levels_suggestions,
        "temperature_level_id",
    )
    reasoning_levels = _dedupe_by_id(
        reasoning_levels_selected + reasoning_levels_suggestions,
        "reasoning_level_id",
    )
    voices = _dedupe_by_id(voices_selected + voices_suggestions, "id")

    # Find selected resources (current selections)
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id), None
    )
    value_resource = next((v for v in values if v.id == selected_value_id), None)
    endpoint_resource = next(
        (e for e in endpoints_list if e.id == selected_endpoint_id), None
    )
    key_resource = next((k for k in keys if k.id == selected_key_id), None)

    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]
    input_modality_resources = [
        m for m in modalities if m.id in selected_input_modality_ids
    ]
    output_modality_resources = [
        m for m in modalities if m.id in selected_output_modality_ids
    ]
    quality_resources = [q for q in qualities if q.id in selected_quality_ids]
    pricing_resources = [p for p in pricing if p.pricing_id in selected_pricing_ids]
    temperature_level_resources = [
        t
        for t in temperature_levels
        if t.temperature_level_id in selected_temperature_level_ids
    ]
    reasoning_level_resources = [
        r
        for r in reasoning_levels
        if r.reasoning_level_id in selected_reasoning_level_ids
    ]
    voice_resources = [v for v in voices if v.id in selected_voice_ids]

    # Build suggestion ID lists
    name_suggestions_ids = [n.id for n in names_suggestions]
    description_suggestions_ids = [d.id for d in descriptions_suggestions]
    value_suggestions_ids = [v.id for v in values_suggestions]
    endpoint_suggestions_ids = [e.id for e in endpoints_suggestions]
    key_suggestions_ids = [k.id for k in keys_suggestions]
    department_suggestions_ids = [d.department_id for d in departments_suggestions]
    modality_suggestions_ids = [m.id for m in modalities_suggestions]
    quality_suggestions_ids = [q.id for q in qualities_suggestions]
    pricing_suggestions_ids = [p.pricing_id for p in pricing_suggestions]
    temperature_level_suggestions_ids = [
        t.temperature_level_id for t in temperature_levels_suggestions
    ]
    reasoning_level_suggestions_ids = [
        r.reasoning_level_id for r in reasoning_levels_suggestions
    ]
    voice_suggestions_ids = [v.id for v in voices_suggestions]

    # Compute show flags
    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_value_flag = compute_show_value(values_has_tools)
    show_endpoint_flag = compute_show_endpoint(endpoints_has_tools)
    show_provider_flag = compute_show_provider()
    show_key_flag = compute_show_key()
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_modalities_flag = compute_show_modalities()
    show_temperature_levels_flag = compute_show_temperature_levels()
    show_pricing_flag = compute_show_pricing()
    show_reasoning_levels_flag = compute_show_reasoning_levels()
    show_qualities_flag = compute_show_qualities()
    show_voices_flag = compute_show_voices()

    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "values": show_value_flag,
        "endpoints": show_endpoint_flag,
        "providers": show_provider_flag,
        "keys": show_key_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "modalities": show_modalities_flag,
        "temperature_levels": show_temperature_levels_flag,
        "pricing": show_pricing_flag,
        "reasoning_levels": show_reasoning_levels_flag,
        "qualities": show_qualities_flag,
        "voices": show_voices_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "values": compute_value_required(),
        "endpoints": compute_endpoint_required(),
        "providers": compute_provider_required(),
        "keys": compute_key_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "modalities": compute_modalities_required(),
        "temperature_levels": compute_temperature_levels_required(),
        "pricing": compute_pricing_required(),
        "reasoning_levels": compute_reasoning_levels_required(),
        "qualities": compute_qualities_required(),
        "voices": compute_voices_required(),
    }

    # Build rich domain metadata
    domain_data_list = build_domain_data(
        domain_ids_map, show_flags_map, required_flags_map
    )

    # Transform flags to enriched format for client
    model_flags = [
        ModelFlagConfig(
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

    # Validation for new mode
    if model_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # Detail mode: check access via name_resource
    if model_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail=(
                "You don't have access to this model."
                " It may be restricted to other departments."
            ),
        )

    # === Construct Response ===
    resources_payload = ModelResources(
        resources=ModelResourceBucket(
            names=names,
            descriptions=descriptions,
            values=values,
            endpoints=endpoints_list,
            providers=[],  # Providers don't have a generic resource endpoint yet
            keys=keys,
            flags=model_flags,
            departments=departments,
            input_modalities=modalities,
            output_modalities=modalities,
            temperature_levels=temperature_levels,
            pricing=pricing,
            reasoning_levels=reasoning_levels,
            qualities=qualities,
            voices=voices,
        ),
        current=ModelResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            values=[value_resource] if value_resource else [],
            endpoints=[endpoint_resource] if endpoint_resource else [],
            providers=[],
            keys=[key_resource] if key_resource else [],
            flags=[f for f in model_flags if f.flag_option_id in flag_ids],
            departments=department_resources or [],
            input_modalities=input_modality_resources or [],
            output_modalities=output_modality_resources or [],
            temperature_levels=temperature_level_resources or [],
            pricing=pricing_resources or [],
            reasoning_levels=reasoning_level_resources or [],
            qualities=quality_resources or [],
            voices=voice_resources or [],
        ),
    )

    # Build domains list for WebSocket handler
    domains_list: list[DomainAgent] = []
    for resource, domain_id in domain_ids_map.items():
        if domain_id is not None:
            domains_list.append(
                DomainAgent(
                    domain_id=domain_id,
                    agent_id=agent_ids.get(resource),
                    group_id=resource_group_ids.get(resource),
                )
            )

    # Build suggestions map
    suggestions_map: dict[str, list[UUID]] = {
        "names": name_suggestions_ids,
        "descriptions": description_suggestions_ids,
        "values": value_suggestions_ids,
        "endpoints": endpoint_suggestions_ids,
        "keys": key_suggestions_ids,
        "departments": department_suggestions_ids,
        "modalities": modality_suggestions_ids,
        "temperature_levels": temperature_level_suggestions_ids,
        "pricing": pricing_suggestions_ids,
        "reasoning_levels": reasoning_level_suggestions_ids,
        "qualities": quality_suggestions_ids,
        "voices": voice_suggestions_ids,
    }

    return ModelInternalData(
        actor_name=access_result.actor_name,
        model_exists=access_result.model_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        domain_ids_map=domain_ids_map,
        agent_ids=agent_ids,
        domains_list=domains_list,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        provider_show_ai_generate=provider_show_ai_generate,
        features_show_ai_generate=features_show_ai_generate,
        domain_data_list=domain_data_list,
        resources_payload=resources_payload,
        resource_group_ids=resource_group_ids,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
    )


async def get_model_websocket(
    profile_id: UUID,
    model_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetModelWebsocketResponse:
    """Minimal response for WebSocket handlers."""
    data = await get_model_internal(
        profile_id=profile_id,
        model_id=model_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetModelWebsocketResponse(
        group_id=data.group_id,
        name_domain_id=data.domain_ids_map.get("names"),
        description_domain_id=data.domain_ids_map.get("descriptions"),
        value_domain_id=data.domain_ids_map.get("values"),
        endpoint_domain_id=data.domain_ids_map.get("endpoints"),
        provider_domain_id=data.domain_ids_map.get("providers"),
        key_domain_id=data.domain_ids_map.get("keys"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        modalities_domain_id=data.domain_ids_map.get("modalities"),
        temperature_levels_domain_id=data.domain_ids_map.get("temperature_levels"),
        pricing_domain_id=data.domain_ids_map.get("pricing"),
        reasoning_levels_domain_id=data.domain_ids_map.get("reasoning_levels"),
        qualities_domain_id=data.domain_ids_map.get("qualities"),
        voices_domain_id=data.domain_ids_map.get("voices"),
        domains=data.domains_list,
        resources=data.resources_payload,
    )


async def get_model_client(
    profile_id: UUID,
    model_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetModelApiResponse:
    """BFF response for HTTP endpoint/frontend."""
    data = await get_model_internal(
        profile_id=profile_id,
        model_id=model_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetModelApiResponse(
        actor_name=data.actor_name,
        model_exists=data.model_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        # Per-resource group IDs
        names_group_id=data.resource_group_ids.get("names"),
        descriptions_group_id=data.resource_group_ids.get("descriptions"),
        values_group_id=data.resource_group_ids.get("values"),
        endpoints_group_id=data.resource_group_ids.get("endpoints"),
        providers_group_id=data.resource_group_ids.get("providers"),
        keys_group_id=data.resource_group_ids.get("keys"),
        flags_group_id=data.resource_group_ids.get("flags"),
        departments_group_id=data.resource_group_ids.get("departments"),
        modalities_group_id=data.resource_group_ids.get("modalities"),
        temperature_levels_group_id=data.resource_group_ids.get("temperature_levels"),
        pricing_group_id=data.resource_group_ids.get("pricing"),
        reasoning_levels_group_id=data.resource_group_ids.get("reasoning_levels"),
        qualities_group_id=data.resource_group_ids.get("qualities"),
        voices_group_id=data.resource_group_ids.get("voices"),
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
        # Value
        show_value=data.show_flags_map.get("values"),
        value_domain_id=data.domain_ids_map.get("values"),
        value_required=data.required_flags_map.get("values"),
        value_suggestions=data.suggestions_map.get("values"),
        value_show_ai_generate=data.show_ai_generate_map.get("values"),
        # Endpoint
        show_endpoint=data.show_flags_map.get("endpoints"),
        endpoint_domain_id=data.domain_ids_map.get("endpoints"),
        endpoint_required=data.required_flags_map.get("endpoints"),
        endpoint_suggestions=data.suggestions_map.get("endpoints"),
        endpoint_show_ai_generate=data.show_ai_generate_map.get("endpoints"),
        # Provider
        show_provider=data.show_flags_map.get("providers"),
        provider_domain_id=data.domain_ids_map.get("providers"),
        provider_required=data.required_flags_map.get("providers"),
        provider_suggestions=[],
        provider_show_ai_generate=data.show_ai_generate_map.get("providers"),
        # Key
        show_key=data.show_flags_map.get("keys"),
        key_domain_id=data.domain_ids_map.get("keys"),
        key_required=data.required_flags_map.get("keys"),
        key_suggestions=data.suggestions_map.get("keys"),
        key_show_ai_generate=data.show_ai_generate_map.get("keys"),
        # Flag
        show_flag=data.show_flags_map.get("flags"),
        flag_domain_id=data.domain_ids_map.get("flags"),
        flag_required=data.required_flags_map.get("flags"),
        flag_show_ai_generate=data.show_ai_generate_map.get("flags"),
        # Departments
        show_departments=data.show_flags_map.get("departments"),
        departments_domain_id=data.domain_ids_map.get("departments"),
        departments_required=data.required_flags_map.get("departments"),
        department_suggestions=data.suggestions_map.get("departments"),
        departments_show_ai_generate=data.show_ai_generate_map.get("departments"),
        # Modalities
        show_modalities=data.show_flags_map.get("modalities"),
        modalities_domain_id=data.domain_ids_map.get("modalities"),
        modalities_required=data.required_flags_map.get("modalities"),
        input_modality_suggestions=[],
        output_modality_suggestions=[],
        modalities_show_ai_generate=data.show_ai_generate_map.get("modalities"),
        # Temperature Levels
        show_temperature_levels=data.show_flags_map.get("temperature_levels"),
        temperature_levels_domain_id=data.domain_ids_map.get("temperature_levels"),
        temperature_levels_required=data.required_flags_map.get("temperature_levels"),
        temperature_level_suggestions=data.suggestions_map.get("temperature_levels"),
        temperature_levels_show_ai_generate=data.show_ai_generate_map.get(
            "temperature_levels"
        ),
        # Pricing
        show_pricing=data.show_flags_map.get("pricing"),
        pricing_domain_id=data.domain_ids_map.get("pricing"),
        pricing_required=data.required_flags_map.get("pricing"),
        pricing_suggestions=data.suggestions_map.get("pricing"),
        pricing_show_ai_generate=data.show_ai_generate_map.get("pricing"),
        # Reasoning Levels
        show_reasoning_levels=data.show_flags_map.get("reasoning_levels"),
        reasoning_levels_domain_id=data.domain_ids_map.get("reasoning_levels"),
        reasoning_levels_required=data.required_flags_map.get("reasoning_levels"),
        reasoning_level_suggestions=data.suggestions_map.get("reasoning_levels"),
        reasoning_levels_show_ai_generate=data.show_ai_generate_map.get(
            "reasoning_levels"
        ),
        # Qualities
        show_qualities=data.show_flags_map.get("qualities"),
        qualities_domain_id=data.domain_ids_map.get("qualities"),
        qualities_required=data.required_flags_map.get("qualities"),
        quality_suggestions=data.suggestions_map.get("qualities"),
        qualities_show_ai_generate=data.show_ai_generate_map.get("qualities"),
        # Voices
        show_voices=data.show_flags_map.get("voices"),
        voices_domain_id=data.domain_ids_map.get("voices"),
        voices_required=data.required_flags_map.get("voices"),
        voice_suggestions=data.suggestions_map.get("voices"),
        voices_show_ai_generate=data.show_ai_generate_map.get("voices"),
        # Step-level AI generation flags
        basic_show_ai_generate=data.basic_show_ai_generate,
        features_show_ai_generate=data.features_show_ai_generate,
        # Domain metadata
        domain_data=data.domain_data_list,
        # Resources
        resources=data.resources_payload,
        # CREATE tool IDs
        name_create_tool_id=data.create_tool_ids_map.get("names"),
        description_create_tool_id=data.create_tool_ids_map.get("descriptions"),
        value_create_tool_id=data.create_tool_ids_map.get("values"),
        endpoint_create_tool_id=data.create_tool_ids_map.get("endpoints"),
        key_create_tool_id=data.create_tool_ids_map.get("keys"),
        # LINK tool IDs
        name_link_tool_id=data.link_tool_ids_map.get("names"),
        description_link_tool_id=data.link_tool_ids_map.get("descriptions"),
        value_link_tool_id=data.link_tool_ids_map.get("values"),
        endpoint_link_tool_id=data.link_tool_ids_map.get("endpoints"),
        provider_link_tool_id=data.link_tool_ids_map.get("providers"),
        key_link_tool_id=data.link_tool_ids_map.get("keys"),
        flag_link_tool_id=data.link_tool_ids_map.get("flags"),
        departments_link_tool_id=data.link_tool_ids_map.get("departments"),
        modalities_link_tool_id=data.link_tool_ids_map.get("modalities"),
        temperature_levels_link_tool_id=data.link_tool_ids_map.get(
            "temperature_levels"
        ),
        pricing_link_tool_id=data.link_tool_ids_map.get("pricing"),
        reasoning_levels_link_tool_id=data.link_tool_ids_map.get("reasoning_levels"),
        qualities_link_tool_id=data.link_tool_ids_map.get("qualities"),
        voices_link_tool_id=data.link_tool_ids_map.get("voices"),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name.

    Example: 'model_active' -> ('active', 'Active')
    """
    if not name:
        return ("unknown", "Unknown")
    # Remove artifact prefix (e.g., 'model_active' -> 'active')
    key = name.replace("model_", "")
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


@router.post(
    "/get",
    response_model=GetModelApiResponse,
    dependencies=[
        audit_activity(
            "model.get",
            "{{ actor.name }} {% if model %}viewed{% else %}"
            "opened new{% endif %} model"
            "{% if model %} '{{ model.name }}'{% endif %}",
        )
    ],
)
async def get_model(
    request: GetModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetModelApiResponse:
    """Get model information using two-pass architecture.

    This is a thin HTTP wrapper around get_model_internal().
    """
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_model_client(
            profile_id=profile_id,
            model_id=request.model_id,
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
            if request.model_id and current_name:
                audit_ctx["model"] = {
                    "name": current_name,
                    "id": str(request.model_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "models"
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
            operation="get_model",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )

"""Model get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_model_internal() - Core data fetching (cacheable, returns dataclass)
2. get_model_websocket() - Minimal data for WebSocket handlers
3. get_model_client() - Full BFF response for HTTP endpoint/frontend
"""

import asyncio
from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.model.permissions import (
    MODEL_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_modalities_required,
    compute_name_required,
    compute_pricing_required,
    compute_provider_required,
    compute_qualities_required,
    compute_reasoning_levels_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
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
    derive_flag_key_and_label,
    has_access,
)
from app.api.v4.artifacts.model.types import (
    GetModelAccessSqlParams,
    GetModelAccessSqlRow,
    GetModelApiRequest,
    GetModelApiResponse,
    GetModelIdsSqlParams,
    GetModelIdsSqlRow,
    GetModelWebsocketResponse,
    ModelDepartmentSection,
    ModelDescriptionSection,
    ModelFlagConfig,
    ModelFlagSection,
    ModelModalitySection,
    ModelNameSection,
    ModelPricingSection,
    ModelProviderSection,
    ModelQualitySection,
    ModelReasoningLevelSection,
    ModelTemperatureLevelSection,
    ModelValueSection,
    ModelVoiceSection,
    ModelWebsocketResources,
    ModelWebsocketViews,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.api.v4.permissions import select_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.modalities.get import get_modalities_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.pricing.get import get_pricing_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.api.v4.resources.qualities.get import get_qualities_internal
from app.api.v4.resources.reasoning_levels.get import get_reasoning_levels_internal
from app.api.v4.resources.temperature_levels.get import get_temperature_levels_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.api.v4.resources.values.get import get_values_internal
from app.api.v4.resources.voices.get import get_voices_internal
from app.api.v4.types import CandidateAgent
from app.api.v4.views.drafts.get import get_draft_model_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import load_sql_query
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/models/get_model_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/models/get_model_ids_complete.sql"

router = APIRouter()


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


@dataclass
class ModelInternalData:
    """Internal data from core model fetching (cacheable layer)."""

    # Access/context
    actor_name: str | None
    model_exists: bool | None
    can_edit: bool
    disabled_reason: str | None
    draft_version: int | None
    group_id: UUID | None

    agent_ids: dict[str, UUID | None]

    # Show/required flags
    show_flags_map: dict[str, bool]
    required_flags_map: dict[str, bool]

    # Suggestions (resource -> list of suggestion IDs)
    suggestions_map: dict[str, list[UUID]]

    # Show AI generate flags
    show_ai_generate_map: dict[str, bool]
    basic_show_ai_generate: bool
    provider_show_ai_generate: bool
    features_show_ai_generate: bool

    # Selected resources (current selections)
    name_resource: Any | None
    description_resource: Any | None
    value_resource: Any | None
    provider_resource: Any | None
    model_flags: list[ModelFlagConfig]
    department_resources: list[Any]
    modality_resources: list[Any]
    temperature_level_resources: list[Any]
    pricing_resources: list[Any]
    reasoning_level_resources: list[Any]
    quality_resources: list[Any]
    voice_resources: list[Any]

    # All resources (for suggestions/picker)
    names: list[Any]
    descriptions: list[Any]
    values: list[Any]
    providers: list[Any]
    flags: list[ModelFlagConfig]
    departments: list[Any]
    modalities: list[Any]
    temperature_levels: list[Any]
    pricing: list[Any]
    reasoning_levels: list[Any]
    qualities: list[Any]
    voices: list[Any]

    # Per-resource tool IDs (from selected agents)
    create_tool_ids_map: dict[str, UUID | None]
    link_tool_ids_map: dict[str, UUID | None]

    # Config resources for websocket generation
    config_agent_resources: list[Any] | None
    config_model_resources: list[Any] | None
    config_provider_resources: list[Any] | None


async def get_model_internal(
    profile_id: UUID,
    model_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ModelInternalData:
    """Core data fetching layer (cacheable)."""
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
    user_department_ids = [
        d.department_id for d in resolved_context.departments if d.department_id
    ]

    # Fetch draft if draft_id provided
    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_draft_model_internal(
                conn=draft_conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    async with pool.acquire() as conn:
        # === QUERY 1: Access Check ===
        query1_params = GetModelAccessSqlParams(
            profile_id=profile_id,
            model_id=model_id,
            draft_id=draft_id,
        )

        access_result = cast(
            GetModelAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        # Extract artifact-specific state from Query 1 (no user context)
        model_department_ids = access_result.model_department_ids or []
        active_persona_count = access_result.active_persona_count or 0

        if model_id is not None:
            if access_result.model_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Model {model_id} not found",
                )
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

        # === QUERY 2: ID Fetching ===
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

    # === PARSE CANDIDATE AGENTS AND SELECT BEST AGENTS ===
    candidate_agents = CandidateAgent.from_sql_rows(ids_result.candidate_agents)
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

    # === COMPUTE SHOW_AI_GENERATE FLAGS ===
    def _compute_show_ai_generate(resource: str) -> bool:
        return agent_ids.get(resource) is not None

    show_ai_generate_map = {r: _compute_show_ai_generate(r) for r in MODEL_RESOURCES}

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False)
        for r in ["names", "descriptions", "flags", "departments"]
    )
    provider_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in ["values", "providers"]
    )
    features_show_ai_generate = any(
        show_ai_generate_map.get(r, False)
        for r in [
            "modalities",
            "temperature_levels",
            "pricing",
            "reasoning_levels",
            "qualities",
            "voices",
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

    # === EXTRACT SELECTED IDS ===
    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_value_id = ids_result.value_id
    selected_provider_id = ids_result.provider_id

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
    selected_modality_ids = ids_result.modality_ids or []
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
        if draft_item.value_ids:
            selected_value_id = draft_item.value_ids[0]
        if draft_item.provider_ids:
            selected_provider_id = draft_item.provider_ids[0]
        if draft_item.flag_ids:
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids
        if draft_item.modality_ids:
            selected_modality_ids = draft_item.modality_ids
        if draft_item.temperature_level_ids:
            selected_temperature_level_ids = draft_item.temperature_level_ids
        if draft_item.pricing_ids:
            selected_pricing_ids = draft_item.pricing_ids
        if draft_item.reasoning_level_ids:
            selected_reasoning_level_ids = draft_item.reasoning_level_ids
        if draft_item.quality_ids:
            selected_quality_ids = draft_item.quality_ids
        if draft_item.voice_ids:
            selected_voice_ids = draft_item.voice_ids

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    value_ids_list = [selected_value_id] if selected_value_id else []
    provider_ids_list = [selected_provider_id] if selected_provider_id else []
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

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names_internal(c, name_ids, bypass_cache)
            suggestions = await search_names_internal(
                c, None, 20, 0, effective_group_id, None, name_ids, bypass_cache,
                model=True,
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
            return (selected, [])

    async def fetch_providers():
        async with pool.acquire() as c:
            selected = await get_providers_internal(c, provider_ids_list, bypass_cache)
            return (selected, [])

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c, None, 50, 0, flag_ids, bypass_cache, artifact_type="model"
            )
            suggestions = [f for f in all_flags if f.name in MODEL_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(
                c, selected_department_ids, bypass_cache
            )
            suggestions = await search_departments_internal(
                c,
                None,
                20,
                0,
                user_department_ids,
                "all",
                selected_department_ids,
                bypass_cache,
            )
            return (selected, suggestions)

    async def fetch_modalities():
        async with pool.acquire() as c:
            selected = await get_modalities_internal(
                c, selected_modality_ids, bypass_cache
            )
            return (selected, [])

    async def fetch_temperature_levels():
        async with pool.acquire() as c:
            selected = await get_temperature_levels_internal(
                c, selected_temperature_level_ids, bypass_cache
            )
            return (selected, [])

    async def fetch_pricing():
        async with pool.acquire() as c:
            selected = await get_pricing_internal(c, selected_pricing_ids, bypass_cache)
            return (selected, [])

    async def fetch_reasoning_levels():
        async with pool.acquire() as c:
            selected = await get_reasoning_levels_internal(
                c, selected_reasoning_level_ids, bypass_cache
            )
            return (selected, [])

    async def fetch_qualities():
        async with pool.acquire() as c:
            selected = await get_qualities_internal(
                c, selected_quality_ids, bypass_cache
            )
            return (selected, [])

    async def fetch_voices():
        async with pool.acquire() as c:
            selected = await get_voices_internal(c, selected_voice_ids, bypass_cache)
            return (selected, [])

    # Parallel fetch
    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (values_selected, values_suggestions),
        (providers_selected, providers_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (modalities_selected, modalities_suggestions),
        (temperature_levels_selected, temperature_levels_suggestions),
        (pricing_selected, pricing_suggestions),
        (reasoning_levels_selected, reasoning_levels_suggestions),
        (qualities_selected, qualities_suggestions),
        (voices_selected, voices_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_values(),
        fetch_providers(),
        fetch_flags(),
        fetch_departments(),
        fetch_modalities(),
        fetch_temperature_levels(),
        fetch_pricing(),
        fetch_reasoning_levels(),
        fetch_qualities(),
        fetch_voices(),
    )

    # Dedupe resources
    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    values = _dedupe_by_id(values_selected + values_suggestions, "id")
    providers = _dedupe_by_id(providers_selected + providers_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    modalities = _dedupe_by_id(modalities_selected + modalities_suggestions, "id")
    temperature_levels = _dedupe_by_id(
        temperature_levels_selected + temperature_levels_suggestions,
        "temperature_level_id",
    )
    pricing = _dedupe_by_id(pricing_selected + pricing_suggestions, "pricing_id")
    reasoning_levels = _dedupe_by_id(
        reasoning_levels_selected + reasoning_levels_suggestions,
        "reasoning_level_id",
    )
    qualities = _dedupe_by_id(qualities_selected + qualities_suggestions, "id")
    voices = _dedupe_by_id(voices_selected + voices_suggestions, "id")

    # Find selected resources
    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id), None
    )
    value_resource = next((v for v in values if v.id == selected_value_id), None)
    provider_resource = next(
        (p for p in providers if p.id == selected_provider_id), None
    )

    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]
    modality_resources = [m for m in modalities if m.id in selected_modality_ids]
    temperature_level_resources = [
        t
        for t in temperature_levels
        if t.temperature_level_id in selected_temperature_level_ids
    ]
    pricing_resources_list = [
        p for p in pricing if p.pricing_id in selected_pricing_ids
    ]
    reasoning_level_resources = [
        r
        for r in reasoning_levels
        if r.reasoning_level_id in selected_reasoning_level_ids
    ]
    quality_resources = [q for q in qualities if q.id in selected_quality_ids]
    voice_resources = [v for v in voices if v.id in selected_voice_ids]

    # Build flag configs
    show_flag = compute_show_flag()
    model_flags = [
        ModelFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flag,
            required=compute_flag_required(),
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
    ]

    # Compute show/required flags
    names_has_tools = ids_result.names_has_tools or False
    values_has_tools = ids_result.values_has_tools or False

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
        "descriptions": compute_show_description(),
        "values": compute_show_value(values_has_tools),
        "providers": compute_show_provider(),
        "flags": show_flag,
        "departments": compute_show_departments(len(departments)),
        "modalities": compute_show_modalities(),
        "temperature_levels": compute_show_temperature_levels(),
        "pricing": compute_show_pricing(),
        "reasoning_levels": compute_show_reasoning_levels(),
        "qualities": compute_show_qualities(),
        "voices": compute_show_voices(),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "values": compute_value_required(),
        "providers": compute_provider_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "modalities": compute_modalities_required(),
        "temperature_levels": compute_temperature_levels_required(),
        "pricing": compute_pricing_required(),
        "reasoning_levels": compute_reasoning_levels_required(),
        "qualities": compute_qualities_required(),
        "voices": compute_voices_required(),
    }

    # Suggestion IDs
    suggestions_map: dict[str, list[UUID]] = {
        "names": [n.id for n in names_suggestions],
        "descriptions": [d.id for d in descriptions_suggestions],
        "values": [v.id for v in values_suggestions],
        "departments": [d.department_id for d in departments_suggestions],
        "modalities": [m.id for m in modalities_suggestions],
        "temperature_levels": [
            t.temperature_level_id for t in temperature_levels_suggestions
        ],
        "pricing": [p.pricing_id for p in pricing_suggestions],
        "reasoning_levels": [
            r.reasoning_level_id for r in reasoning_levels_suggestions
        ],
        "qualities": [q.id for q in qualities_suggestions],
        "voices": [v.id for v in voices_suggestions],
    }

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

    # Fetch config resources for websocket generation context
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

    return ModelInternalData(
        actor_name=actor_name,
        model_exists=access_result.model_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        agent_ids=agent_ids,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        provider_show_ai_generate=provider_show_ai_generate,
        features_show_ai_generate=features_show_ai_generate,
        name_resource=name_resource,
        description_resource=description_resource,
        value_resource=value_resource,
        provider_resource=provider_resource,
        model_flags=model_flags,
        department_resources=department_resources,
        modality_resources=modality_resources,
        temperature_level_resources=temperature_level_resources,
        pricing_resources=pricing_resources_list,
        reasoning_level_resources=reasoning_level_resources,
        quality_resources=quality_resources,
        voice_resources=voice_resources,
        names=names,
        descriptions=descriptions,
        values=values,
        providers=providers,
        flags=model_flags,
        departments=departments,
        modalities=modalities,
        temperature_levels=temperature_levels,
        pricing=pricing,
        reasoning_levels=reasoning_levels,
        qualities=qualities,
        voices=voices,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        config_agent_resources=config_agents_result or None,
        config_model_resources=config_models_result or None,
        config_provider_resources=config_providers_result or None,
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

    draft_view = None
    if draft_id is not None:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")
        async with pool.acquire() as conn:
            draft_items = await get_draft_model_internal(
                conn=conn,
                draft_ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            draft_view = draft_items[0] if draft_items else None

    # Get selected flag configs
    selected_flag_ids = {f.flag_option_id for f in data.model_flags if f.flag_option_id}
    selected_enriched_flags = [
        f for f in data.flags if f.flag_option_id in selected_flag_ids
    ]

    tools_result: list[Any] = []
    if data.config_agent_resources:
        tool_ids: list[UUID] = []
        for agent in data.config_agent_resources:
            ids = getattr(agent, "tool_ids", None) or []
            tool_ids.extend(ids)
        deduped_tool_ids = list(dict.fromkeys(tool_ids))
        if deduped_tool_ids:
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not initialized")
            async with pool.acquire() as conn:
                tools_result = await get_tools_internal(
                    conn, deduped_tool_ids, bypass_cache
                )

    return GetModelWebsocketResponse(
        group_id=data.group_id,
        views=ModelWebsocketViews(draft_model=draft_view) if draft_view else None,
        resource_agent_ids=data.agent_ids,
        resources=ModelWebsocketResources(
            names=[data.name_resource] if data.name_resource else None,
            descriptions=(
                [data.description_resource] if data.description_resource else None
            ),
            values=[data.value_resource] if data.value_resource else None,
            providers=[data.provider_resource] if data.provider_resource else None,
            flags=selected_enriched_flags or None,
            departments=data.department_resources or None,
            modalities=data.modality_resources or None,
            temperature_levels=data.temperature_level_resources or None,
            pricing=data.pricing_resources or None,
            reasoning_levels=data.reasoning_level_resources or None,
            qualities=data.quality_resources or None,
            voices=data.voice_resources or None,
            agents=data.config_agent_resources,
            models=data.config_model_resources,
            config_providers=data.config_provider_resources,
            tools=tools_result or None,
        ),
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

    def section_common(resource_key: str) -> dict[str, Any]:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key, []),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "create_tool_id": data.create_tool_ids_map.get(resource_key),
            "link_tool_id": data.link_tool_ids_map.get(resource_key),
        }

    return GetModelApiResponse(
        actor_name=data.actor_name,
        model_exists=data.model_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        provider_show_ai_generate=data.provider_show_ai_generate,
        features_show_ai_generate=data.features_show_ai_generate,
        names=ModelNameSection(
            resource=data.name_resource,
            resources=data.names,
            **section_common("names"),
        ),
        descriptions=ModelDescriptionSection(
            resource=data.description_resource,
            resources=data.descriptions,
            **section_common("descriptions"),
        ),
        values=ModelValueSection(
            resource=data.value_resource,
            resources=data.values,
            **section_common("values"),
        ),
        providers=ModelProviderSection(
            resource=data.provider_resource,
            resources=data.providers,
            **section_common("providers"),
        ),
        flags=ModelFlagSection(
            current=[
                f
                for f in data.model_flags
                if f.flag_option_id
                and f.flag_option_id in {ff.flag_option_id for ff in data.model_flags}
            ],
            resources=data.flags,
            **section_common("flags"),
        ),
        departments=ModelDepartmentSection(
            current=data.department_resources or None,
            resources=data.departments,
            **section_common("departments"),
        ),
        modalities=ModelModalitySection(
            current=data.modality_resources or None,
            resources=data.modalities,
            **section_common("modalities"),
        ),
        temperature_levels=ModelTemperatureLevelSection(
            current=data.temperature_level_resources or None,
            resources=data.temperature_levels,
            **section_common("temperature_levels"),
        ),
        pricing=ModelPricingSection(
            current=data.pricing_resources or None,
            resources=data.pricing,
            **section_common("pricing"),
        ),
        reasoning_levels=ModelReasoningLevelSection(
            current=data.reasoning_level_resources or None,
            resources=data.reasoning_levels,
            **section_common("reasoning_levels"),
        ),
        qualities=ModelQualitySection(
            current=data.quality_resources or None,
            resources=data.qualities,
            **section_common("qualities"),
        ),
        voices=ModelVoiceSection(
            current=data.voice_resources or None,
            resources=data.voices,
            **section_common("voices"),
        ),
    )


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
    """Get model information using two-pass architecture."""
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
            current_name = (
                getattr(response_data.names.resource, "name", None)
                if response_data.names and response_data.names.resource
                else None
            )
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

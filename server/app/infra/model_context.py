"""Resolve model artifact context — merged junctions + hydrated resources.

Given a model_id (and optional draft_id), fetches the published artifact
and draft entry, merges junction IDs (draft overrides published), then
hydrates all resources in parallel (selected + suggestions).

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.types import ArtifactContext, ResourcePair

# Artifact + draft fetchers
from app.routes.v5.tools.artifacts.model.get import (
    get_models as get_model_artifacts,
)
from app.routes.v5.tools.entries.model_drafts.get import get_model_drafts

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.departments.get import get_departments

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.descriptions.search import search_descriptions
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.modalities.get import get_modalities
from app.routes.v5.tools.resources.modalities.search import search_modalities
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.pricing.get import get_pricing
from app.routes.v5.tools.resources.pricing.search import search_pricing
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.providers.search import search_providers
from app.routes.v5.tools.resources.qualities.get import get_qualities
from app.routes.v5.tools.resources.qualities.search import search_qualities
from app.routes.v5.tools.resources.reasoning_levels.get import get_reasoning_levels
from app.routes.v5.tools.resources.reasoning_levels.search import (
    search_reasoning_levels,
)
from app.routes.v5.tools.resources.temperature_levels.get import get_temperature_levels
from app.routes.v5.tools.resources.temperature_levels.search import (
    search_temperature_levels,
)
from app.routes.v5.tools.resources.values.get import get_values
from app.routes.v5.tools.resources.values.search import search_values
from app.routes.v5.tools.resources.voices.get import get_voices
from app.routes.v5.tools.resources.voices.search import search_voices

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MODEL_FLAG_NAMES = {
    "model_active",
    "model_modalities_enabled",
    "model_temperature_enabled",
    "model_pricing_enabled",
    "model_voices_enabled",
    "model_reasoning_levels_enabled",
    "model_qualities_enabled",
}


# ---------------------------------------------------------------------------
# resolve_model_context
# ---------------------------------------------------------------------------


async def resolve_model_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    model_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve a model artifact into fully hydrated resources for the GET endpoint.

    Steps:
      1. Fetch artifact + draft in parallel -> merge IDs
      2. Parallel hydrate: get (selected) + search (suggestions) per resource
      3. Assemble ArtifactContext with ResourcePairs
    """
    user_dept_ids = user_department_ids or []

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_model_artifacts(
            conn,
            [model_id],
            names=True,
            descriptions=True,
            departments=True,
            flags=True,
            values=True,
            providers=True,
            modalities=True,
            temperature_levels=True,
            pricing=True,
            reasoning_levels=True,
            qualities=True,
            voices=True,
        )
        if model_id
        else _empty()
    )
    draft_task = get_model_drafts(conn, [draft_id]) if draft_id else _empty()

    artifacts, drafts = await asyncio.gather(artifact_task, draft_task)

    artifact = artifacts[0] if artifacts else None
    draft = drafts[0] if drafts else None

    # Merge IDs: start from published, draft overrides if present
    merged = _merge_junction_ids(artifact, draft)
    draft_version = draft.version if draft else None
    active = artifact.active if artifact else True

    # Step 2: parallel hydrate — selected + suggestions for each resource
    (
        names_selected,
        names_suggestions,
        descriptions_selected,
        descriptions_suggestions,
        flags_selected,
        flags_suggestions,
        departments_selected,
        departments_suggestions,
        values_selected,
        values_suggestions,
        providers_selected,
        providers_suggestions,
        modalities_selected,
        modalities_suggestions,
        temperature_levels_selected,
        temperature_levels_suggestions,
        pricing_selected,
        pricing_suggestions,
        reasoning_levels_selected,
        reasoning_levels_suggestions,
        qualities_selected,
        qualities_suggestions,
        voices_selected,
        voices_suggestions,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.name_ids,
            bypass_cache=bypass_cache,
            model=True,
        ),
        # Descriptions
        get_descriptions(conn, merged.description_ids, redis, bypass_cache),
        search_descriptions(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.description_ids,
            bypass_cache=bypass_cache,
            model=True,
        ),
        # Flags
        get_flags(conn, merged.flag_ids, redis, bypass_cache),
        search_flags(
            conn,
            redis,
            search=None,
            limit_count=50,
            offset_count=0,
            exclude_ids=merged.flag_ids,
            bypass_cache=bypass_cache,
            model=True,
        ),
        # Departments
        get_departments(conn, merged.department_ids, redis, bypass_cache),
        search_departments(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            department_ids=user_dept_ids,
            suggest_source="all" if model_id is None else "recent",
            exclude_ids=merged.department_ids,
            bypass_cache=bypass_cache,
        ),
        # Values
        get_values(conn, merged.value_ids, redis, bypass_cache),
        search_values(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.value_ids,
            bypass_cache=bypass_cache,
        ),
        # Providers
        get_providers(conn, merged.provider_ids, redis, bypass_cache=bypass_cache),
        search_providers(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.provider_ids,
            bypass_cache=bypass_cache,
        ),
        # Modalities
        get_modalities(conn, merged.modality_ids, redis, bypass_cache),
        search_modalities(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.modality_ids,
            bypass_cache=bypass_cache,
        ),
        # Temperature levels
        get_temperature_levels(conn, merged.temperature_level_ids, redis, bypass_cache),
        search_temperature_levels(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.temperature_level_ids,
            bypass_cache=bypass_cache,
        ),
        # Pricing
        get_pricing(conn, merged.pricing_ids, redis, bypass_cache),
        search_pricing(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.pricing_ids,
            bypass_cache=bypass_cache,
        ),
        # Reasoning levels
        get_reasoning_levels(conn, merged.reasoning_level_ids, redis, bypass_cache),
        search_reasoning_levels(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.reasoning_level_ids,
            bypass_cache=bypass_cache,
        ),
        # Qualities
        get_qualities(conn, merged.quality_ids, redis, bypass_cache),
        search_qualities(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.quality_ids,
            bypass_cache=bypass_cache,
        ),
        # Voices
        get_voices(conn, merged.voice_ids, redis, bypass_cache),
        search_voices(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.voice_ids,
            bypass_cache=bypass_cache,
        ),
    )

    # Filter flags to model-specific types
    flags_suggestions_filtered = [
        f for f in flags_suggestions if getattr(f, "name", None) in MODEL_FLAG_NAMES
    ]

    return ArtifactContext(
        artifact_id=artifact.id if artifact else None,
        active=active,
        group_id=group_id,
        draft_version=draft_version,
        resources={
            "names": ResourcePair(
                selected=names_selected, suggestions=names_suggestions
            ),
            "descriptions": ResourcePair(
                selected=descriptions_selected, suggestions=descriptions_suggestions
            ),
            "flags": ResourcePair(
                selected=flags_selected, suggestions=flags_suggestions_filtered
            ),
            "departments": ResourcePair(
                selected=departments_selected, suggestions=departments_suggestions
            ),
            "values": ResourcePair(
                selected=values_selected, suggestions=values_suggestions
            ),
            "providers": ResourcePair(
                selected=providers_selected, suggestions=providers_suggestions
            ),
            "modalities": ResourcePair(
                selected=modalities_selected, suggestions=modalities_suggestions
            ),
            "temperature_levels": ResourcePair(
                selected=temperature_levels_selected,
                suggestions=temperature_levels_suggestions,
            ),
            "pricing": ResourcePair(
                selected=pricing_selected, suggestions=pricing_suggestions
            ),
            "reasoning_levels": ResourcePair(
                selected=reasoning_levels_selected,
                suggestions=reasoning_levels_suggestions,
            ),
            "qualities": ResourcePair(
                selected=qualities_selected, suggestions=qualities_suggestions
            ),
            "voices": ResourcePair(
                selected=voices_selected, suggestions=voices_suggestions
            ),
        },
        entries={},
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


@dataclass
class _MergedIds:
    """Merged junction IDs from artifact + draft."""

    name_ids: list[UUID]
    description_ids: list[UUID]
    flag_ids: list[UUID]
    department_ids: list[UUID]
    value_ids: list[UUID]
    provider_ids: list[UUID]
    modality_ids: list[UUID]
    temperature_level_ids: list[UUID]
    pricing_ids: list[UUID]
    reasoning_level_ids: list[UUID]
    quality_ids: list[UUID]
    voice_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:
    """Merge artifact junction IDs with draft overrides."""
    name_ids = list(artifact.name_ids or []) if artifact else []
    description_ids = list(artifact.description_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    department_ids = list(artifact.department_ids or []) if artifact else []
    value_ids = list(artifact.value_ids or []) if artifact else []
    provider_ids = list(artifact.provider_ids or []) if artifact else []
    modality_ids = list(artifact.modality_ids or []) if artifact else []
    temperature_level_ids = (
        list(artifact.temperature_level_ids or []) if artifact else []
    )
    pricing_ids = list(artifact.pricing_ids or []) if artifact else []
    reasoning_level_ids = list(artifact.reasoning_level_ids or []) if artifact else []
    quality_ids = list(artifact.quality_ids or []) if artifact else []
    voice_ids = list(artifact.voice_ids or []) if artifact else []

    # Draft overrides (if present) — ignore profile_ids from draft
    if draft:
        if draft.name_ids:
            name_ids = list(draft.name_ids)
        if draft.description_ids:
            description_ids = list(draft.description_ids)
        if draft.flag_ids:
            flag_ids = list(draft.flag_ids)
        if draft.department_ids:
            department_ids = list(draft.department_ids)
        if draft.value_ids:
            value_ids = list(draft.value_ids)
        if draft.provider_ids:
            provider_ids = list(draft.provider_ids)
        if draft.modality_ids:
            modality_ids = list(draft.modality_ids)
        if draft.temperature_level_ids:
            temperature_level_ids = list(draft.temperature_level_ids)
        if draft.pricing_ids:
            pricing_ids = list(draft.pricing_ids)
        if draft.reasoning_level_ids:
            reasoning_level_ids = list(draft.reasoning_level_ids)
        if draft.quality_ids:
            quality_ids = list(draft.quality_ids)
        if draft.voice_ids:
            voice_ids = list(draft.voice_ids)

    return _MergedIds(
        name_ids=name_ids,
        description_ids=description_ids,
        flag_ids=flag_ids,
        department_ids=department_ids,
        value_ids=value_ids,
        provider_ids=provider_ids,
        modality_ids=modality_ids,
        temperature_level_ids=temperature_level_ids,
        pricing_ids=pricing_ids,
        reasoning_level_ids=reasoning_level_ids,
        quality_ids=quality_ids,
        voice_ids=voice_ids,
    )


async def _empty() -> list:
    return []

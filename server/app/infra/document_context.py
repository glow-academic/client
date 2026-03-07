"""Resolve document artifact context — merged junctions + hydrated resources.

Given a document_id (and optional draft_id), fetches the published artifact
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
from app.routes.v5.tools.artifacts.document.get import (
    get_documents as get_document_artifacts,
)
from app.routes.v5.tools.entries.document_drafts.get import get_document_drafts

# Entry MV fetchers (aliased to avoid collision with resource search functions)
from app.routes.v5.tools.entries.files.search import search_files as search_file_entries
from app.routes.v5.tools.entries.images.search import (
    search_images as search_image_entries,
)
from app.routes.v5.tools.entries.texts.search import search_texts as search_text_entries

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.departments.get import get_departments

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.descriptions.search import search_descriptions
from app.routes.v5.tools.resources.fields.search import search_fields
from app.routes.v5.tools.resources.files.get import get_files
from app.routes.v5.tools.resources.files.search import search_files
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.images.get import get_images
from app.routes.v5.tools.resources.images.search import search_images
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.parameter_fields.get import get_parameter_fields
from app.routes.v5.tools.resources.parameter_fields.search import (
    search_parameter_fields,
)
from app.routes.v5.tools.resources.parameters.get import get_parameters
from app.routes.v5.tools.resources.parameters.search import search_parameters
from app.routes.v5.tools.resources.texts.get import get_texts
from app.routes.v5.tools.resources.texts.search import search_texts

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DOCUMENT_FLAG_TYPES = {"document_active"}


# ---------------------------------------------------------------------------
# resolve_document_context
# ---------------------------------------------------------------------------


async def resolve_document_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    document_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
    parameter_ids: list[UUID] | None = None,
    # Search filters
    descriptions_search: str | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve a document artifact into fully hydrated resources.

    Steps:
      1. Fetch artifact + draft in parallel → merge IDs
      2. Parallel hydrate: get (selected) + search (suggestions) per resource
      3. Entry MV fetches for files, images, texts
      4. Assemble ArtifactContext with ResourcePairs
    """
    user_dept_ids = user_department_ids or []
    param_ids = parameter_ids or []

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_document_artifacts(
            conn,
            [document_id],
            names=True,
            descriptions=True,
            departments=True,
            flags=True,
            files=True,
            images=True,
            parameter_fields=True,
            parameters=True,
            texts=True,
        )
        if document_id
        else _empty()
    )
    draft_task = get_document_drafts(conn, [draft_id]) if draft_id else _empty()

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
        parameter_fields_selected,
        parameter_fields_suggestions,
        files_selected,
        files_suggestions,
        images_selected,
        images_suggestions,
        texts_selected,
        texts_suggestions,
        parameters_selected,
        parameters_suggestions,
        fields_catalog,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.name_ids,
            bypass_cache=bypass_cache,
            document=True,
        ),
        # Descriptions
        get_descriptions(conn, merged.description_ids, redis, bypass_cache),
        search_descriptions(
            conn,
            redis,
            search=descriptions_search,
            draft_id=group_id,
            suggest_source="all",
            exclude_ids=merged.description_ids,
            bypass_cache=bypass_cache,
            document=True,
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
            document=True,
        ),
        # Departments
        get_departments(conn, merged.department_ids, redis, bypass_cache=bypass_cache),
        search_departments(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            department_ids=user_dept_ids,
            suggest_source="all",
            exclude_ids=merged.department_ids,
            bypass_cache=bypass_cache,
        ),
        # Parameter fields
        get_parameter_fields(conn, merged.parameter_field_ids, redis, bypass_cache),
        (
            search_parameter_fields(
                conn,
                redis,
                parameter_ids=param_ids,
                bypass_cache=bypass_cache,
                document=True,
            )
            if param_ids
            else _empty()
        ),
        # Files
        get_files(conn, merged.files_ids, redis, bypass_cache),
        search_files(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.files_ids,
            bypass_cache=bypass_cache,
            document=True,
        ),
        # Images
        get_images(conn, merged.images_ids, redis, bypass_cache),
        search_images(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.images_ids,
            bypass_cache=bypass_cache,
            document=True,
        ),
        # Texts
        get_texts(conn, merged.texts_ids, redis, bypass_cache),
        search_texts(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.texts_ids,
            bypass_cache=bypass_cache,
        ),
        # Parameters (from URL, not saved state)
        get_parameters(conn, param_ids, redis, bypass_cache) if param_ids else _empty(),
        search_parameters(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            persona_parameter=None,
            document_parameter=True,
            scenario_parameter=None,
            video_parameter=None,
            suggest_source="all",
            exclude_ids=param_ids,
            bypass_cache=bypass_cache,
        ),
        # Fields catalog
        search_fields(
            conn,
            redis,
            search=None,
            limit_count=200,
            offset_count=0,
            department_ids=user_dept_ids,
            bypass_cache=bypass_cache,
        ),
    )

    # Filter flags to document-specific types
    flags_suggestions_filtered = [
        f for f in flags_suggestions if getattr(f, "type", None) in DOCUMENT_FLAG_TYPES
    ]

    # Step 3: Entry MV fetches (files, images, texts — for file_path/mime_type)
    all_file_ids = [f.id for f in files_selected + files_suggestions if f.id]
    all_image_ids = [i.id for i in images_selected + images_suggestions if i.id]
    all_text_ids = [t.id for t in texts_selected + texts_suggestions if t.id]

    file_entries, image_entries, text_entries = await asyncio.gather(
        search_file_entries(conn, files_ids=all_file_ids, limit=200)
        if all_file_ids
        else _empty(),
        search_image_entries(conn, images_ids=all_image_ids, limit=200)
        if all_image_ids
        else _empty(),
        search_text_entries(conn, text_ids=all_text_ids, limit=200)
        if all_text_ids
        else _empty(),
    )

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
            "parameter_fields": ResourcePair(
                selected=parameter_fields_selected,
                suggestions=parameter_fields_suggestions,
            ),
            "files": ResourcePair(
                selected=files_selected, suggestions=files_suggestions
            ),
            "images": ResourcePair(
                selected=images_selected, suggestions=images_suggestions
            ),
            "texts": ResourcePair(
                selected=texts_selected, suggestions=texts_suggestions
            ),
            "parameters": ResourcePair(
                selected=parameters_selected, suggestions=parameters_suggestions
            ),
            "fields": ResourcePair(selected=[], suggestions=fields_catalog),
        },
        entries={
            "files": file_entries,
            "images": image_entries,
            "texts": text_entries,
        },
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
    parameter_field_ids: list[UUID]
    files_ids: list[UUID]
    images_ids: list[UUID]
    texts_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:
    """Merge artifact junction IDs with draft overrides."""
    name_ids = list(artifact.name_ids or []) if artifact else []
    description_ids = list(artifact.description_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    department_ids = list(artifact.department_ids or []) if artifact else []
    parameter_field_ids = list(artifact.parameter_field_ids or []) if artifact else []
    # Artifact uses files_ids, images_ids, texts_ids (plural with 's')
    files_ids = list(artifact.files_ids or []) if artifact else []
    images_ids = list(artifact.images_ids or []) if artifact else []
    texts_ids = list(artifact.texts_ids or []) if artifact else []

    if draft:
        if draft.name_ids:
            name_ids = list(draft.name_ids)
        if draft.description_ids:
            description_ids = list(draft.description_ids)
        if draft.flag_ids:
            flag_ids = list(draft.flag_ids)
        if draft.department_ids:
            department_ids = list(draft.department_ids)
        if draft.parameter_field_ids:
            parameter_field_ids = list(draft.parameter_field_ids)
        # Draft uses file_ids, image_ids, text_ids (without extra 's')
        if draft.file_ids:
            files_ids = list(draft.file_ids)
        if draft.image_ids:
            images_ids = list(draft.image_ids)
        if draft.text_ids:
            texts_ids = list(draft.text_ids)

    return _MergedIds(
        name_ids=name_ids,
        description_ids=description_ids,
        flag_ids=flag_ids,
        department_ids=department_ids,
        parameter_field_ids=parameter_field_ids,
        files_ids=files_ids,
        images_ids=images_ids,
        texts_ids=texts_ids,
    )


async def _empty() -> list:
    return []

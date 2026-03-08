"""Document search logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments, name)
  2. search_documents — core artifact search (IDs + total_count)
  3. get_documents — hydrate junction IDs
  4. Resource get tools — hydrate names, files (uploads)
  5. Permissions — compute per-document can_edit, can_delete, can_duplicate
  6. Facets — parallel resource/artifact searches for filter options
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.api.main.document.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.document.types import (
    ListDocumentApiDocument,
    ListDocumentApiResponse,
)
from app.routes.v5.api.types import ListFilterOption, ListFilterSection
from app.routes.v5.tools.artifacts.document.get import get_documents
from app.routes.v5.tools.artifacts.document.search import search_documents
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.fields.search import (
    search_fields as search_fields_resource,
)
from app.routes.v5.tools.resources.files.get import get_files as get_uploads
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.scenarios.search import (
    search_scenarios as search_scenarios_resource,
)


async def search_document_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    # Main filters
    search: str | None = None,
    scenario_ids: list[UUID] | None = None,
    field_ids: list[UUID] | None = None,
    filter_department_ids: list[UUID] | None = None,
    # Facet search text
    scenario_search: str | None = None,
    field_search: str | None = None,
    department_search: str | None = None,
    # Pagination
    page_size: int = 12,
    page_offset: int = 0,
) -> ListDocumentApiResponse:
    """Document search using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, departments, name
      2. search_documents -> (document_artifact_ids, total_count)
      3. get_documents -> hydrate junction IDs
      4. Parallel: hydrate resources + compute permissions + facets
      5. Hydrate upload_id from files_resource
    """
    from fastapi import HTTPException

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    user_role = profile.role
    user_department_ids = profile.department_ids
    actor_name = profile.name

    # -- Step 2: Search documents --
    # The artifact search tool handles scenario_ids and field_ids filters internally

    document_ids, total_count = await search_documents(
        conn,
        search=search,
        department_ids=filter_department_ids,
        scenario_ids=scenario_ids,
        field_ids=field_ids,
        limit_count=page_size,
        offset_count=page_offset,
    )

    if not document_ids:
        return _empty_response(actor_name, total_count=0)

    # -- Step 3: Get document artifacts with junction IDs --

    artifacts = await get_documents(
        conn,
        document_ids,
        names=True,
        departments=True,
        flags=True,
        files=True,
        documents=True,
    )

    # -- Step 4: Parallel hydration + facets --

    all_name_ids: list[UUID] = []
    all_files_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_files_ids.extend(a.files_ids or [])

    # Deduplicate files IDs
    all_files_ids = list(set(all_files_ids))

    (
        names_data,
        uploads_data,
        active_scenario_counts,
        scenario_facet,
        field_facet,
        department_facet,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty_list(),
        get_uploads(conn, all_files_ids, redis) if all_files_ids else _empty_list(),
        _fetch_active_scenario_counts(conn, artifacts),
        search_scenarios_resource(
            conn, redis, search=scenario_search, scenario=True, limit_count=100
        ),
        search_fields_resource(
            conn, redis, search=field_search, parameter=True, limit_count=100
        ),
        search_departments(
            conn, redis, search=department_search, document=True, limit_count=100
        ),
    )

    # Build lookup maps
    name_map = {n.id: n for n in names_data}
    # Build files_resource ID -> upload_id map
    upload_resource_to_file_id: dict[UUID, UUID] = {}
    for u in uploads_data:
        if u.id:
            # files_resource.id is the upload_id for download
            upload_resource_to_file_id[u.id] = u.id

    # -- Step 5: Build document list with permissions --

    documents: list[ListDocumentApiDocument] = []

    for a in artifacts:
        name_obj = name_map.get(a.name_ids[0]) if a.name_ids else None

        dept_ids_str = [str(d) for d in (a.department_ids or [])]
        active_scenario_count = active_scenario_counts.get(a.id, 0)

        is_inactive = not a.active

        can_edit = compute_can_edit(
            user_role=user_role,
            document_department_ids=dept_ids_str,
            active_scenario_count=active_scenario_count,
            user_department_ids=user_department_ids,
        )
        can_delete = compute_can_delete(
            user_role=user_role,
            document_department_ids=dept_ids_str,
            active_scenario_count=active_scenario_count,
        )
        can_duplicate = compute_can_duplicate(user_role)

        # Resolve upload_id from files_ids
        upload_id: UUID | None = None
        for fid in a.files_ids or []:
            if fid in upload_resource_to_file_id:
                upload_id = upload_resource_to_file_id[fid]
                break

        documents.append(
            ListDocumentApiDocument(
                document_id=a.id,
                name=name_obj.name if name_obj else None,
                department_ids=dept_ids_str,
                scenario_ids=None,
                field_ids=None,
                is_inactive=is_inactive,
                num_scenarios=active_scenario_count,
                active_scenario_count=active_scenario_count,
                upload_id=upload_id,
                can_edit=can_edit,
                can_duplicate=can_duplicate,
                can_delete=can_delete,
                updated_at=a.updated_at,
            )
        )

    # -- Step 6: Build facet sections --

    scenario_filter = ListFilterSection(
        options=[
            ListFilterOption(id=str(s.id), name=s.name, count=0) for s in scenario_facet
        ],
        selected_ids=[str(sid) for sid in scenario_ids] if scenario_ids else None,
        search=scenario_search,
    )

    field_filter = ListFilterSection(
        options=[
            ListFilterOption(id=str(f.id), name=f.name, count=0) for f in field_facet
        ],
        selected_ids=[str(fid) for fid in field_ids] if field_ids else None,
        search=field_search,
    )

    department_filter = ListFilterSection(
        options=[
            ListFilterOption(id=str(d.id), name=d.name, count=0)
            for d in department_facet
        ],
        selected_ids=[str(did) for did in filter_department_ids]
        if filter_department_ids
        else None,
        search=department_search,
    )

    return ListDocumentApiResponse(
        actor_name=actor_name,
        documents=documents,
        scenario_filter=scenario_filter,
        field_filter=field_filter,
        department_filter=department_filter,
        total_count=total_count,
    )


# -- Helpers --


def _empty_response(
    actor_name: str | None = None, total_count: int = 0
) -> ListDocumentApiResponse:
    return ListDocumentApiResponse(
        actor_name=actor_name,
        documents=[],
        total_count=total_count,
    )


async def _empty_list() -> list:
    return []


async def _fetch_active_scenario_counts(
    conn: asyncpg.Connection,
    artifacts: list,
) -> dict[UUID, int]:
    """Count active scenarios per document artifact.

    Path: document_artifact -> document_documents_junction -> documents_resource
          -> scenario_documents_junction -> scenario_artifact
    """
    all_document_resource_ids: list[UUID] = []
    artifact_to_doc_resource: dict[UUID, list[UUID]] = {}

    for a in artifacts:
        doc_res_ids = a.document_ids or []
        artifact_to_doc_resource[a.id] = doc_res_ids
        all_document_resource_ids.extend(doc_res_ids)

    if not all_document_resource_ids:
        return {}

    rows = await conn.fetch(
        """
        SELECT sdj.documents_id, COUNT(DISTINCT sdj.scenario_id) as cnt
        FROM scenario_documents_junction sdj
        JOIN scenario_artifact sa ON sa.id = sdj.scenario_id AND sa.active = true
        WHERE sdj.documents_id = ANY($1) AND sdj.active = true
        GROUP BY sdj.documents_id
        """,
        all_document_resource_ids,
    )

    resource_counts: dict[UUID, int] = {r["documents_id"]: r["cnt"] for r in rows}

    result: dict[UUID, int] = {}
    for a_id, doc_res_ids in artifact_to_doc_resource.items():
        total = sum(resource_counts.get(did, 0) for did in doc_res_ids)
        if total > 0:
            result[a_id] = total

    return result

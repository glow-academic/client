"""Field search logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments, name)
  2. search_fields — core artifact search (IDs + total_count)
  3. get_fields — hydrate junction IDs
  4. Resource get tools — hydrate names, descriptions
  5. Permissions — compute per-field can_edit, can_delete, can_duplicate
  6. Facets — parallel resource/artifact searches for filter options
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.field_permissions_context import resolve_field_permissions_context
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.field_permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.field.types import (
    ListFieldApiField,
    ListFieldApiResponse,
)
from app.routes.v5.api.types import ListFilterOption, ListFilterSection
from app.routes.v5.tools.artifacts.field.get import get_fields
from app.routes.v5.tools.artifacts.field.search import search_fields
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.parameters.search import (
    search_parameters as search_parameters_resource,
)
from app.routes.v5.tools.resources.personas.search import (
    search_personas as search_personas_resource,
)


async def search_field_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    # Main filters
    search: str | None = None,
    parameter_ids: list[UUID] | None = None,
    persona_ids: list[UUID] | None = None,
    filter_department_ids: list[UUID] | None = None,
    # Facet search text
    parameter_search: str | None = None,
    persona_search: str | None = None,
    department_search: str | None = None,
    # Pagination
    page_size: int = 12,
    page_offset: int = 0,
) -> ListFieldApiResponse:
    """Field search using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, departments, name
      2. search_fields -> (field_artifact_ids, total_count)
      3. get_fields -> hydrate junction IDs
      4. Parallel: hydrate resources + compute permissions + facets
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

    # -- Step 2: Search fields --
    # The artifact search tool handles parameter_ids and persona_ids filters internally

    field_ids, total_count = await search_fields(
        conn,
        search=search,
        department_ids=filter_department_ids,
        parameter_ids=parameter_ids,
        persona_ids=persona_ids,
        limit_count=page_size,
        offset_count=page_offset,
    )

    if not field_ids:
        return _empty_response(actor_name, total_count=0)

    # -- Step 3: Get field artifacts with junction IDs --

    artifacts = await get_fields(
        conn,
        field_ids,
        names=True,
        descriptions=True,
        departments=True,
        flags=True,
        conditional_parameters=True,
        fields=True,
    )

    # -- Step 4: Parallel hydration + facets --

    all_name_ids: list[UUID] = []
    all_description_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_description_ids.extend(a.description_ids or [])

    # Per-field permissions context (gives us active_parameter_count)
    perm_tasks = [resolve_field_permissions_context(conn, a.id) for a in artifacts]

    (
        names_data,
        descriptions_data,
        parameter_facet,
        persona_facet,
        department_facet,
        *perm_results,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty_list(),
        get_descriptions(conn, all_description_ids, redis)
        if all_description_ids
        else _empty_list(),
        search_parameters_resource(
            conn, redis, search=parameter_search, parameter=True, limit_count=100
        ),
        search_personas_resource(
            conn, redis, search=persona_search, persona=True, limit_count=100
        ),
        search_departments(
            conn, redis, search=department_search, field=True, limit_count=100
        ),
        *perm_tasks,
    )

    # Build lookup maps
    name_map = {n.id: n for n in names_data}
    description_map = {d.id: d for d in descriptions_data}

    # -- Step 5: Build field list with permissions --

    fields: list[ListFieldApiField] = []

    for i, a in enumerate(artifacts):
        name_obj = name_map.get(a.name_ids[0]) if a.name_ids else None
        desc_obj = (
            description_map.get(a.description_ids[0]) if a.description_ids else None
        )

        dept_ids_str = [str(d) for d in (a.department_ids or [])]
        active_param_count = perm_results[i].active_parameter_count

        is_inactive = not a.active

        can_edit = compute_can_edit(
            user_role=user_role,
            field_department_ids=dept_ids_str,
            active_parameter_count=active_param_count,
            user_department_ids=user_department_ids,
        )
        can_delete = compute_can_delete(
            user_role=user_role,
            field_department_ids=dept_ids_str,
            active_parameter_count=active_param_count,
        )
        can_duplicate = compute_can_duplicate(user_role)

        fields.append(
            ListFieldApiField(
                field_id=a.id,
                name=name_obj.name if name_obj else None,
                description=desc_obj.description if desc_obj else None,
                department_ids=dept_ids_str,
                conditional_parameter_ids=a.conditional_parameter_ids,
                persona_ids=None,
                is_inactive=is_inactive,
                can_edit=can_edit,
                can_duplicate=can_duplicate,
                can_delete=can_delete,
                updated_at=a.updated_at,
            )
        )

    # -- Step 6: Build facet sections --

    parameter_filter = ListFilterSection(
        options=[
            ListFilterOption(id=str(p.id), name=p.name, count=0)
            for p in parameter_facet
        ],
        selected_ids=[str(pid) for pid in parameter_ids] if parameter_ids else None,
        search=parameter_search,
    )

    persona_filter = ListFilterSection(
        options=[
            ListFilterOption(id=str(p.id), name=p.name, count=0) for p in persona_facet
        ],
        selected_ids=[str(pid) for pid in persona_ids] if persona_ids else None,
        search=persona_search,
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

    return ListFieldApiResponse(
        actor_name=actor_name,
        fields=fields,
        parameter_filter=parameter_filter,
        persona_filter=persona_filter,
        department_filter=department_filter,
        total_count=total_count,
    )


# -- Helpers --


def _empty_response(
    actor_name: str | None = None, total_count: int = 0
) -> ListFieldApiResponse:
    return ListFieldApiResponse(
        actor_name=actor_name,
        fields=[],
        total_count=total_count,
    )


async def _empty_list() -> list:
    return []

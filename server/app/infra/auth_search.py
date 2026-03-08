"""Auth search logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments, name)
  2. search_auths (artifact) — core artifact search (IDs + total_count)
  3. get_auths (artifact) — hydrate junction IDs
  4. Resource get tools — hydrate names, descriptions
  5. Permissions — compute per-auth can_edit, can_delete, can_duplicate
  6. Facets — department search for filter options
  7. active_settings_count — for edit/delete permission checks
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.auth_permissions_context import resolve_auth_permissions_context
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.auth_permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.auth.types import (
    ListAuthApiAuth,
    ListAuthApiResponse,
)
from app.routes.v5.api.types import ListFilterOption, ListFilterSection
from app.routes.v5.tools.artifacts.auth.get import get_auths
from app.routes.v5.tools.artifacts.auth.search import (
    search_auths as search_auth_artifacts,
)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.get import get_names


async def search_auth_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    # Main filters
    search: str | None = None,
    filter_department_ids: list[UUID] | None = None,
    # Facet search text
    department_search: str | None = None,
    # Pagination
    page_size: int = 1000,
    page_offset: int = 0,
) -> ListAuthApiResponse:
    """Auth search using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, departments, name
      2. search_auths → (auth_artifact_ids, total_count)
      3. get_auths → hydrate junction IDs
      4. Parallel: hydrate resources + facets + active_settings_counts
      5. Compute permissions per auth
    """
    from fastapi import HTTPException

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    user_role = profile.role
    actor_name = profile.name

    # ── Step 2: Search auths ──────────────────────────────────────────

    auth_ids, total_count = await search_auth_artifacts(
        conn,
        search=search,
        department_ids=filter_department_ids,
        limit_count=page_size,
        offset_count=page_offset,
    )

    if not auth_ids:
        # Still fetch facets for empty results
        department_facet = await search_departments(
            conn, redis, search=department_search, auth=True, limit_count=100
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

        return ListAuthApiResponse(
            actor_name=actor_name,
            auths=[],
            department_filter=department_filter,
            total_count=0,
        )

    # ── Step 3: Get auth artifacts with junction IDs ──────────────────

    artifacts = await get_auths(
        conn,
        auth_ids,
        names=True,
        descriptions=True,
        departments=True,
        flags=True,
        items=True,
    )

    # ── Step 4: Parallel hydration + facets ────────────────────────────

    all_name_ids: list[UUID] = []
    all_description_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_description_ids.extend(a.description_ids or [])

    # Per-auth permissions context (gives us active_settings_count)
    perm_tasks = [resolve_auth_permissions_context(conn, a.id) for a in artifacts]

    (
        names_data,
        descriptions_data,
        department_facet,
        *perm_results,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty_list(),
        get_descriptions(conn, all_description_ids, redis)
        if all_description_ids
        else _empty_list(),
        search_departments(
            conn, redis, search=department_search, auth=True, limit_count=100
        ),
        *perm_tasks,
    )

    # Build lookup maps
    name_map = {n.id: n for n in names_data}
    description_map = {d.id: d for d in descriptions_data}

    # ── Step 5: Build auth list with permissions ──────────────────────

    auths_list: list[ListAuthApiAuth] = []

    for i, a in enumerate(artifacts):
        name_obj = name_map.get(a.name_ids[0]) if a.name_ids else None
        desc_obj = (
            description_map.get(a.description_ids[0]) if a.description_ids else None
        )

        dept_ids_str = [str(d) for d in (a.department_ids or [])]
        active_settings_count = perm_results[i].active_settings_count
        item_count = len(a.item_ids or [])

        can_edit = compute_can_edit(
            user_role=user_role,
            active_settings_count=active_settings_count,
        )
        can_delete = compute_can_delete(
            user_role=user_role,
            active_settings_count=active_settings_count,
        )
        can_duplicate = compute_can_duplicate(user_role=user_role)

        auths_list.append(
            ListAuthApiAuth(
                auth_id=a.id,
                name=name_obj.name if name_obj else None,
                description=desc_obj.description if desc_obj else None,
                item_count=item_count,
                department_ids=dept_ids_str,
                is_inactive=not a.active,
                can_edit=can_edit,
                can_duplicate=can_duplicate,
                can_delete=can_delete,
            )
        )

    # ── Step 6: Build facet sections ──────────────────────────────────

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

    return ListAuthApiResponse(
        actor_name=actor_name,
        auths=auths_list,
        department_filter=department_filter,
        total_count=total_count,
    )


# ── Helpers ────────────────────────────────────────────────────────────


async def _empty_list() -> list:
    return []

"""Auth save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_auth_permissions_context — access check
  3. Resource create/search tools — raw value -> ID resolution
  4. Artifact create/update tools — junction writes
  5. Auth resource create tool — denormalized snapshot
  6. perform_keycloak_sync — sync auth state (non-fatal)
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.auth.keycloak_sync import perform_keycloak_sync
from app.infra.auth_permissions_context import resolve_auth_permissions_context
from app.infra.profile_identity_context import resolve_profile_identity_context

# Artifact tools
from app.routes.v5.tools.artifacts.auth.create import (
    create_auth as create_auth_artifact,
)
from app.routes.v5.tools.artifacts.auth.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.auth.update import (
    update_auth as update_auth_artifact,
)

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.auths.create import (
    create_auth as create_auth_resource,
)

# Resource search tools (match by name -> ID)
from app.routes.v5.tools.resources.departments.search import search_departments

# Resource create tools (raw value -> ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

if TYPE_CHECKING:
    from app.routes.v5.api.main.auth.types import (
        SaveAuthApiResponse,
        SaveAuthFieldError,
        SaveAuthItem,
        SaveAuthResult,
    )

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Value resolution — raw value -> ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_auth_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: SaveAuthItem,
    is_update: bool,
) -> list[SaveAuthFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.
    For 'match' resources (departments):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.auth.types import SaveAuthFieldError

    errors: list[SaveAuthFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    if item.description is not None and item.description_id is None:
        result = await create_description(conn, item.description, redis)
        item.description_id = result.id

    # --- Match resources ---

    if item.departments is not None and item.department_ids is None:
        all_depts = await search_departments(
            conn,
            redis,
            search=None,
            limit_count=1000,
            auth=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    SaveAuthFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    # --- Validate required fields (create only) ---

    if not is_update:
        if item.name_id is None and item.name is None:
            errors.append(SaveAuthFieldError(field="name", message="Name is required"))

    return errors


# ---------------------------------------------------------------------------
# Denormalized snapshot — hydrate resource IDs to values
# ---------------------------------------------------------------------------


async def _create_denormalized_snapshot(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    name_id: UUID | None,
    description_id: UUID | None,
    department_ids: list[UUID] | None,
) -> UUID:
    """Create an auths_resource snapshot by hydrating IDs to values."""
    import asyncio

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_auth_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
        department_ids=department_ids,
    )
    return result.id


# ---------------------------------------------------------------------------
# save_auth_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_auth_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveAuthItem],
    session_id: UUID | None = None,
    draft_id: UUID | None = None,
    group_id: UUID | None = None,
) -> SaveAuthApiResponse:
    """Auth save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw -> ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
      6. perform_keycloak_sync (non-fatal)
    """
    from app.infra.auth_permissions import (
        compute_can_create,
        compute_can_edit,
    )
    from app.routes.v5.api.main.auth.types import (
        SaveAuthApiResponse,
        SaveAuthResult,
    )

    # -- Step 1: Profile context -----------------------------------------------

    profile = await resolve_profile_identity_context(
        conn,
        profile_id,
        redis,
        session_id=session_id,
        draft_id=draft_id,
    )

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Per-item permission check -------------------------------------

    for idx, item in enumerate(items):
        if item.input_auth_id is not None:
            perms = await resolve_auth_permissions_context(conn, item.input_auth_id)
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Auth {item.input_auth_id} not found.",
                )
            if not compute_can_edit(
                user_role=profile.role,
                active_settings_count=0,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this auth.",
                )
        else:
            if not compute_can_create(user_role=profile.role):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to create an auth.",
                )

    # -- Step 3: Per-item value resolution -------------------------------------

    has_errors = False
    error_results: list[SaveAuthResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_auth_values(
            conn,
            redis,
            item,
            is_update=item.input_auth_id is not None,
        )
        if item_errors:
            has_errors = True
            error_results.append(
                SaveAuthResult(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(SaveAuthResult(success=True, message="Validated"))

    if has_errors:
        return SaveAuthApiResponse(results=error_results)

    # -- Step 4: Single transaction --------------------------------------------

    results: list[SaveAuthResult] = []

    async with conn.transaction():
        for _idx, item in enumerate(items):
            is_update = item.input_auth_id is not None

            # Create denormalized snapshot
            auths_resource_id = await _create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
                department_ids=item.department_ids,
            )

            if is_update:
                result = await update_auth_artifact(
                    conn,
                    item.input_auth_id,
                    name_id=item.name_id if item.name_id else _UNSET,
                    description_id=item.description_id
                    if item.description_id
                    else _UNSET,
                    slug_id=item.slug_id if item.slug_id else _UNSET,
                    department_ids=item.department_ids,
                    flag_ids=[item.active_flag_id] if item.active_flag_id else None,
                    item_ids=item.item_ids,
                    protocol_ids=item.protocol_ids,
                    auth_ids=[auths_resource_id]
                    if auths_resource_id
                    else item.auth_resource_ids,
                )
                auth_id = result.id
            else:
                result = await create_auth_artifact(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    slug_id=item.slug_id,
                    department_ids=item.department_ids,
                    flag_ids=[item.active_flag_id] if item.active_flag_id else None,
                    item_ids=item.item_ids,
                    protocol_ids=item.protocol_ids,
                    auth_ids=[auths_resource_id]
                    if auths_resource_id
                    else item.auth_resource_ids,
                )
                auth_id = result.id

            results.append(
                SaveAuthResult(
                    success=True,
                    auth_id=auth_id,
                    message="Auth updated successfully"
                    if is_update
                    else "Auth created successfully",
                )
            )

    # -- Step 5: Invalidate cache ----------------------------------------------

    await invalidate_tags(["auths"], redis=redis)

    # -- Step 6: Keycloak sync (non-fatal) -------------------------------------

    try:
        await perform_keycloak_sync(department_id=None)
    except Exception:
        logger.warning("Keycloak sync failed after auth save (non-fatal)")

    return SaveAuthApiResponse(results=results)

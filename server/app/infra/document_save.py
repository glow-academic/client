"""Document save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_document_permissions_context — access check
  3. Resource create/search tools — raw value → ID resolution
  4. Artifact create/update tools — junction writes
  5. Document resource create tool — denormalized snapshot
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.document_permissions_context import resolve_document_permissions_context
from app.infra.profile_identity_context import resolve_profile_identity_context

# Artifact tools
from app.routes.v5.tools.artifacts.document.create import (
    create_document as create_document_artifact,
)
from app.routes.v5.tools.artifacts.document.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.document.update import (
    update_document as update_document_artifact,
)

# Resource search tools (match by name → ID)
from app.routes.v5.tools.resources.departments.search import search_departments

# Resource create tools (raw value → ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.documents.create import (
    create_document as create_document_resource,
)
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names
from app.utils.cache.invalidate_tags import invalidate_tags

if TYPE_CHECKING:
    from app.routes.v5.api.main.document.types import (
        SaveDocumentApiResponse,
        SaveDocumentFieldError,
        SaveDocumentItem,
        SaveDocumentResult,
    )


# ---------------------------------------------------------------------------
# Value resolution — raw value → ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_document_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: SaveDocumentItem,
    is_update: bool,
) -> list[SaveDocumentFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.
    For 'match' resources (departments, flags):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.document.types import SaveDocumentFieldError

    errors: list[SaveDocumentFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    if item.description is not None and item.description_id is None:
        result = await create_description(conn, item.description, redis)
        item.description_id = result.id

    # --- Match resources ---

    if item.is_inactive is not None and item.flag_id is None:
        results = await search_flags(
            conn,
            redis,
            search=None,
            flag_type="document_active",
            limit_count=1000,
            document=True,
        )
        match = next((f for f in results if f.type == "document_active"), None)
        if match and match.id:
            if not item.is_inactive:
                # Active → set the document_active flag
                item.flag_id = match.id
            # Inactive → leave flag_id as None (no flag)
        elif not item.is_inactive:
            errors.append(
                SaveDocumentFieldError(
                    field="is_inactive", message="Active flag resource not found"
                )
            )

    if item.departments is not None and item.department_ids is None:
        all_depts = await search_departments(
            conn,
            redis,
            search=None,
            limit_count=1000,
            document=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    SaveDocumentFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    # --- Validate required fields ---

    if item.name_id is None:
        errors.append(SaveDocumentFieldError(field="name", message="Name is required"))

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
) -> UUID:
    """Create a documents_resource snapshot by hydrating IDs to values."""

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_document_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
    )
    return result.id


# ---------------------------------------------------------------------------
# save_document_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_document_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveDocumentItem],
    session_id: UUID | None = None,
    draft_id: UUID | None = None,
    group_id: UUID | None = None,
) -> SaveDocumentApiResponse:
    """Document save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw → ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
    """
    from app.infra.document_permissions import (
        compute_can_create,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.document.types import (
        SaveDocumentApiResponse,
        SaveDocumentResult,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(
        pool, profile_id, redis,
        session_id=session_id,
        draft_id=draft_id,
    )

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Per-item permission check ──────────────────────────────

    async with pool.acquire() as conn:
        for idx, item in enumerate(items):
            if item.input_document_id is not None:
                perms = await resolve_document_permissions_context(
                    conn, item.input_document_id
                )
                if not perms.exists:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Item {idx}: Document {item.input_document_id} not found.",
                    )
                if not has_access(
                    profile.role, profile.department_ids, perms.department_ids
                ):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Item {idx}: You don't have access to this document.",
                    )
                if not compute_can_edit(
                    user_role=profile.role,
                    document_department_ids=perms.department_ids,
                    active_scenario_count=perms.active_scenario_count,
                    user_department_ids=profile.department_ids,
                ):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Item {idx}: You don't have permission to save this document.",
                    )
            else:
                request_department_ids = (
                    [str(d) for d in (item.department_ids or [])]
                    if item.department_ids
                    else []
                )
                if not compute_can_create(profile.role, request_department_ids):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Item {idx}: You don't have permission to create a document.",
                    )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[SaveDocumentResult] = []

    async with pool.acquire() as conn:
        for idx, item in enumerate(items):
            item_errors = await resolve_document_values(
                conn,
                redis,
                item,
                is_update=item.input_document_id is not None,
            )
            if item_errors:
                has_errors = True
                error_results.append(
                    SaveDocumentResult(
                        success=False,
                        message=f"Item {idx}: Validation errors",
                        errors=item_errors,
                    )
                )
            else:
                error_results.append(
                    SaveDocumentResult(success=True, message="Validated")
                )

    if has_errors:
        return SaveDocumentApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[SaveDocumentResult] = []

    async with pool.acquire() as conn:
        async with conn.transaction():
            for item in items:
                is_update = item.input_document_id is not None

                # Create denormalized snapshot
                documents_resource_id = await _create_denormalized_snapshot(
                    conn,
                    redis,
                    name_id=item.name_id,
                    description_id=item.description_id,
                )

                flag_ids = [item.flag_id] if item.flag_id else None

                if is_update:
                    result = await update_document_artifact(
                        conn,
                        item.input_document_id,
                        name_id=item.name_id if item.name_id else _UNSET,
                        description_id=item.description_id
                        if item.description_id
                        else _UNSET,
                        department_ids=item.department_ids,
                        flag_ids=flag_ids,
                        file_ids=item.upload_ids,
                        image_ids=item.image_ids,
                        parameter_field_ids=item.field_ids,
                        text_ids=item.text_ids,
                        document_ids=[documents_resource_id],
                    )
                    document_id = result.id
                else:
                    result = await create_document_artifact(
                        conn,
                        name_id=item.name_id,
                        description_id=item.description_id,
                        department_ids=item.department_ids,
                        flag_ids=flag_ids,
                        file_ids=item.upload_ids,
                        image_ids=item.image_ids,
                        parameter_field_ids=item.field_ids,
                        text_ids=item.text_ids,
                        document_ids=[documents_resource_id],
                    )
                    document_id = result.id

                results.append(
                    SaveDocumentResult(
                        success=True,
                        document_id=document_id,
                        message="Document updated successfully"
                        if is_update
                        else "Document created successfully",
                    )
                )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["documents"], redis=redis)

    return SaveDocumentApiResponse(results=results)

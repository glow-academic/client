"""Eval save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_eval_permissions_context — access check
  3. Resource create/search tools — raw value → ID resolution
  4. Artifact create/update tools — junction writes
  5. Eval resource create tool — denormalized snapshot
  6. sync_benchmark_entries — pre-create benchmark entries (non-fatal)
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.eval_permissions_context import resolve_eval_permissions_context
from app.infra.profile_identity_context import resolve_profile_identity_context

# Artifact tools
from app.routes.v5.tools.artifacts.eval.create import (
    create_eval as create_eval_artifact,
)
from app.routes.v5.tools.artifacts.eval.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.eval.update import (
    update_eval as update_eval_artifact,
)

# Resource search tools (match by name → ID)
from app.routes.v5.tools.resources.departments.search import search_departments

# Resource create tools (raw value → ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.evals.create import (
    create_eval as create_eval_resource,
)
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

if TYPE_CHECKING:
    from app.routes.v5.api.main.eval.types import (
        SaveEvalApiResponse,
        SaveEvalFieldError,
        SaveEvalItem,
        SaveEvalResult,
    )

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Value resolution — raw value → ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_eval_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: SaveEvalItem,
    is_update: bool,
) -> list[SaveEvalFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.
    For 'match' resources (departments):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.eval.types import SaveEvalFieldError

    errors: list[SaveEvalFieldError] = []

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
            eval=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    SaveEvalFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    # --- Validate required fields ---

    if item.name_id is None:
        errors.append(SaveEvalFieldError(field="name", message="Name is required"))

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
    """Create an evals_resource snapshot by hydrating IDs to values."""

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_eval_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
    )
    return result.id


# ---------------------------------------------------------------------------
# save_eval_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_eval_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveEvalItem],
    group_id: UUID | None = None,
) -> SaveEvalApiResponse:
    """Eval save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw → ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
      6. sync_benchmark_entries (non-fatal)
    """
    from app.routes.v5.api.main.eval.permissions import (
        compute_can_create,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.eval.types import (
        SaveEvalApiResponse,
        SaveEvalResult,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Per-item permission check ──────────────────────────────

    for idx, item in enumerate(items):
        if item.input_eval_id is not None:
            perms = await resolve_eval_permissions_context(conn, item.input_eval_id)
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Eval {item.input_eval_id} not found.",
                )
            if not has_access(
                profile.role, profile.department_ids, perms.department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have access to this eval.",
                )
            if not compute_can_edit(user_role=profile.role):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this eval.",
                )
        else:
            if not compute_can_create(user_role=profile.role):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to create an eval.",
                )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[SaveEvalResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_eval_values(
            conn,
            redis,
            item,
            is_update=item.input_eval_id is not None,
        )
        if item_errors:
            has_errors = True
            error_results.append(
                SaveEvalResult(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(SaveEvalResult(success=True, message="Validated"))

    if has_errors:
        return SaveEvalApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[SaveEvalResult] = []
    sync_items: list[tuple[UUID, SaveEvalItem]] = []

    async with conn.transaction():
        for item in items:
            is_update = item.input_eval_id is not None

            # Create denormalized snapshot
            evals_resource_id = await _create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            if is_update:
                result = await update_eval_artifact(
                    conn,
                    item.input_eval_id,
                    name_id=item.name_id if item.name_id else _UNSET,
                    description_id=item.description_id
                    if item.description_id
                    else _UNSET,
                    department_ids=item.department_ids,
                    flag_ids=item.flag_ids,
                    model_ids=item.model_ids,
                    model_flag_ids=item.model_flag_ids,
                    model_rubric_ids=item.model_rubric_ids,
                    model_position_ids=item.model_position_ids,
                    eval_ids=[evals_resource_id],
                )
                eval_id = result.id
            else:
                result = await create_eval_artifact(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    flag_ids=item.flag_ids,
                    model_ids=item.model_ids,
                    model_flag_ids=item.model_flag_ids,
                    model_rubric_ids=item.model_rubric_ids,
                    model_position_ids=item.model_position_ids,
                    eval_ids=[evals_resource_id],
                )
                eval_id = result.id

            results.append(
                SaveEvalResult(
                    success=True,
                    eval_id=eval_id,
                    message="Eval updated successfully"
                    if is_update
                    else "Eval created successfully",
                )
            )
            sync_items.append((evals_resource_id, item))

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["evals"], redis=redis)

    # ── Step 6: Sync benchmark entries (non-fatal) ─────────────────────

    for resource_id, item in sync_items:
        try:
            from app.infra.benchmark_sync import sync_benchmark_entries

            await sync_benchmark_entries(
                conn=conn,
                evals_resource_id=resource_id,
                model_ids=item.model_ids or [],
                model_flag_ids=item.model_flag_ids or [],
                model_rubric_ids=item.model_rubric_ids or [],
                model_position_ids=item.model_position_ids or [],
                department_ids=item.department_ids or [],
            )
        except Exception as sync_err:
            logger.warning(f"sync_benchmark_entries failed (non-fatal): {sync_err}")

    return SaveEvalApiResponse(results=results)

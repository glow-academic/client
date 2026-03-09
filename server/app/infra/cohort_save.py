"""Cohort save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_cohort_permissions_context — access check
  3. Resource create/search tools — raw value → ID resolution
  4. Artifact create/update tools — junction writes
  5. Cohort resource create tool — denormalized snapshot
  6. sync_home_practice_entries — pre-create home/practice + chat entries
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.cohort_permissions_context import resolve_cohort_permissions_context
from app.infra.profile_identity_context import resolve_profile_identity_context

# Artifact tools
from app.routes.v5.tools.artifacts.cohort.create import (
    create_cohort as create_cohort_artifact,
)
from app.routes.v5.tools.artifacts.cohort.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.cohort.update import (
    update_cohort as update_cohort_artifact,
)

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.cohorts.create import (
    create_cohort as create_cohort_resource,
)

# Resource search tools (match by name → ID)
from app.routes.v5.tools.resources.departments.search import search_departments

# Resource create tools (raw value → ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.profiles.search import search_profiles
from app.routes.v5.tools.resources.simulations.search import search_simulations
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

if TYPE_CHECKING:
    from app.routes.v5.api.main.cohort.types import (
        SaveCohortApiResponse,
        SaveCohortFieldError,
        SaveCohortItem,
        SaveCohortResult,
    )

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Value resolution — raw value → ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_cohort_values(
    pool: asyncpg.Pool,
    redis: Redis,
    item: SaveCohortItem,
    is_update: bool,
) -> list[SaveCohortFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.
    For 'match' resources (departments, simulations, profiles, flags):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.cohort.types import SaveCohortFieldError

    errors: list[SaveCohortFieldError] = []

    async with pool.acquire() as conn:
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
                flag_type="cohort_active",
                limit_count=1000,
                cohort=True,
            )
            match = next((f for f in results if f.type == "cohort_active"), None)
            if match and match.id:
                if not item.is_inactive:
                    # Active → set the cohort_active flag
                    item.flag_id = match.id
                # Inactive → leave flag_id as None (no flag)
            elif not item.is_inactive:
                errors.append(
                    SaveCohortFieldError(
                        field="is_inactive", message="Active flag resource not found"
                    )
                )

        if item.departments is not None and item.department_ids is None:
            all_depts = await search_departments(
                conn,
                redis,
                search=None,
                limit_count=1000,
                cohort=True,
            )
            dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
            resolved_ids = []
            for dept_name in item.departments:
                dept_id = dept_name_map.get(dept_name.lower())
                if dept_id:
                    resolved_ids.append(dept_id)
                else:
                    errors.append(
                        SaveCohortFieldError(
                            field="departments",
                            message=f'Department "{dept_name}" not found',
                        )
                    )
            if not any(e.field == "departments" for e in errors):
                item.department_ids = resolved_ids

        if item.simulations is not None and item.simulation_ids is None:
            all_simulations = await search_simulations(
                conn,
                redis,
                search=None,
                limit_count=1000,
                cohort=True,
            )
            sim_name_map = {
                s.name.lower(): s.id for s in all_simulations if s.name and s.id
            }
            resolved_ids = []
            for sim_name in item.simulations:
                sid = sim_name_map.get(sim_name.lower())
                if sid:
                    resolved_ids.append(sid)
                else:
                    errors.append(
                        SaveCohortFieldError(
                            field="simulations",
                            message=f'Simulation "{sim_name}" not found',
                        )
                    )
            if not any(e.field == "simulations" for e in errors):
                item.simulation_ids = resolved_ids

        if item.profiles is not None and item.profile_ids is None:
            all_profiles = await search_profiles(
                conn,
                redis,
                search=None,
                limit_count=1000,
            )
            profile_name_map = {
                p.name.lower(): p.id for p in all_profiles if p.name and p.id
            }
            resolved_ids = []
            for profile_name in item.profiles:
                pid = profile_name_map.get(profile_name.lower())
                if pid:
                    resolved_ids.append(pid)
                else:
                    errors.append(
                        SaveCohortFieldError(
                            field="profiles",
                            message=f'Profile "{profile_name}" not found',
                        )
                    )
            if not any(e.field == "profiles" for e in errors):
                item.profile_ids = resolved_ids

    # --- Validate required fields ---

    if item.name_id is None:
        errors.append(SaveCohortFieldError(field="name", message="Name is required"))

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
    """Create a cohorts_resource snapshot by hydrating IDs to values.

    Expects a connection (called within a transaction block).
    """

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_cohort_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
    )
    return result.id


# ---------------------------------------------------------------------------
# save_cohort_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_cohort_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveCohortItem],
    session_id: UUID | None = None,
    draft_id: UUID | None = None,
    group_id: UUID | None = None,
) -> SaveCohortApiResponse:
    """Cohort save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw → ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
      6. sync_home_practice_entries (non-fatal)
    """
    from app.infra.cohort_permissions import (
        compute_can_create,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.cohort.types import (
        SaveCohortApiResponse,
        SaveCohortResult,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(
        pool,
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

    # ── Step 2: Per-item permission check ──────────────────────────────

    for idx, item in enumerate(items):
        if item.input_cohort_id is not None:
            async with pool.acquire() as conn:
                perms = await resolve_cohort_permissions_context(
                    conn, item.input_cohort_id
                )
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Cohort {item.input_cohort_id} not found.",
                )
            if not has_access(
                profile.role, profile.department_ids, perms.department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have access to this cohort.",
                )
            if not compute_can_edit(
                user_role=profile.role,
                cohort_department_ids=perms.department_ids,
                user_department_ids=profile.department_ids,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this cohort.",
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
                    detail=f"Item {idx}: You don't have permission to create a cohort.",
                )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[SaveCohortResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_cohort_values(
            pool,
            redis,
            item,
            is_update=item.input_cohort_id is not None,
        )
        if item_errors:
            has_errors = True
            error_results.append(
                SaveCohortResult(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(SaveCohortResult(success=True, message="Validated"))

    if has_errors:
        return SaveCohortApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[SaveCohortResult] = []
    sync_items: list[tuple[UUID, SaveCohortItem]] = []

    async with pool.acquire() as conn:
        async with conn.transaction():
            for item in items:
                is_update = item.input_cohort_id is not None

                # Create denormalized snapshot
                cohorts_resource_id = await _create_denormalized_snapshot(
                    conn,
                    redis,
                    name_id=item.name_id,
                    description_id=item.description_id,
                )

                flag_ids = [item.flag_id] if item.flag_id else None

                if is_update:
                    result = await update_cohort_artifact(
                        conn,
                        item.input_cohort_id,
                        name_id=item.name_id if item.name_id else _UNSET,
                        description_id=item.description_id
                        if item.description_id
                        else _UNSET,
                        department_ids=item.department_ids,
                        flag_ids=flag_ids,
                        simulation_ids=item.simulation_ids,
                        simulation_position_ids=item.simulation_position_ids,
                        simulation_availability_ids=item.simulation_availability_ids,
                        profile_ids=item.profile_ids,
                        profile_persona_ids=item.profile_persona_ids,
                        cohort_ids=[cohorts_resource_id],
                    )
                    cohort_id = result.id
                else:
                    result = await create_cohort_artifact(
                        conn,
                        name_id=item.name_id,
                        description_id=item.description_id,
                        department_ids=item.department_ids,
                        flag_ids=flag_ids,
                        simulation_ids=item.simulation_ids,
                        simulation_position_ids=item.simulation_position_ids,
                        simulation_availability_ids=item.simulation_availability_ids,
                        profile_ids=item.profile_ids,
                        profile_persona_ids=item.profile_persona_ids,
                        cohort_ids=[cohorts_resource_id],
                    )
                    cohort_id = result.id

                results.append(
                    SaveCohortResult(
                        success=True,
                        cohort_id=cohort_id,
                        message="Cohort updated successfully"
                        if is_update
                        else "Cohort created successfully",
                    )
                )
                sync_items.append((cohorts_resource_id, item))

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["cohorts"], redis=redis)

    # ── Step 6: Sync entry rows (non-fatal) ────────────────────────────

    for resource_id, item in sync_items:
        try:
            from app.infra.home_practice_sync import sync_home_practice_entries

            await sync_home_practice_entries(
                pool=pool,
                cohorts_resource_id=resource_id,
                simulation_ids=item.simulation_ids or [],
                simulation_position_ids=item.simulation_position_ids or [],
                simulation_availability_ids=item.simulation_availability_ids or [],
                department_ids=item.department_ids or [],
                profile_ids=item.profile_ids or [],
                profile_persona_ids=item.profile_persona_ids or [],
            )
        except Exception as sync_err:
            logger.warning(f"sync_home_practice_entries failed (non-fatal): {sync_err}")

    return SaveCohortApiResponse(results=results)

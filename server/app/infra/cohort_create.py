"""Cohort create logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. compute_can_create — permission check
  3. resolve_cohort_values — raw value → ID resolution
  4. create_cohort_artifact — junction writes
  5. create_denormalized_snapshot — cohorts_resource snapshot
  6. sync_home_practice_entries — pre-create home/practice + chat entries
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.cohort_permissions_context import (
    create_denormalized_snapshot,
    resolve_cohort_values,
)
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.artifacts.cohort.create import (
    create_cohort as create_cohort_artifact,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def create_cohort_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list,
    group_id: UUID | None = None,
) -> dict:
    """Cohort bulk create using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. compute_can_create — single check (applies to all items)
      3. Per-item value resolution (raw → ID, required field enforcement)
      4. Single transaction: create_cohort_artifact + denormalized snapshot per item
      5. invalidate_tags
      6. sync_home_practice_entries (non-fatal)
    """
    from app.routes.v5.api.main.cohort.permissions import compute_can_create
    from app.routes.v5.api.main.cohort.types import (
        CohortResultItem,
        CreateCohortApiResponse,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Permission check ───────────────────────────────────────

    if not compute_can_create(profile.role, []):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to create cohorts.",
        )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[CohortResultItem] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_cohort_values(conn, redis, item, is_create=True)
        if item_errors:
            has_errors = True
            error_results.append(
                CohortResultItem(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(CohortResultItem(success=True, message="Validated"))

    if has_errors:
        return CreateCohortApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[CohortResultItem] = []
    sync_items: list[tuple[UUID, object]] = []

    async with conn.transaction():
        for item in items:
            # Create denormalized snapshot
            cohorts_resource_id = await create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            flag_ids = [item.flag_id] if item.flag_id else None

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

            results.append(
                CohortResultItem(
                    success=True,
                    cohort_id=result.id,
                    message="Cohort created successfully",
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
                conn=conn,
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

    return CreateCohortApiResponse(results=results)

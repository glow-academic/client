"""Scenario create logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. compute_can_create — permission check
  3. resolve_scenario_values — raw value → ID resolution
  4. create_scenario_artifact — junction writes
  5. create_denormalized_snapshot — scenarios_resource snapshot
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.scenario_permissions_context import (
    create_denormalized_snapshot,
    resolve_scenario_values,
)
from app.routes.v5.tools.artifacts.scenario.create import (
    create_scenario as create_scenario_artifact,
)
from app.utils.cache.invalidate_tags import invalidate_tags


def _collect_flag_ids(item) -> list[UUID] | None:
    """Collect all non-None flag IDs from the item into a single list."""
    flag_ids = []
    for fid in [
        item.active_flag_id,
        item.objectives_enabled_flag_id,
        item.images_enabled_flag_id,
        item.video_enabled_flag_id,
        item.questions_enabled_flag_id,
        item.problem_statement_enabled_flag_id,
    ]:
        if fid is not None:
            flag_ids.append(fid)
    return flag_ids if flag_ids else None


async def create_scenario_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list,
    group_id: UUID | None = None,
) -> dict:
    """Scenario bulk create using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. compute_can_create — single check (applies to all items)
      3. Per-item value resolution (raw → ID, required field enforcement)
      4. Single transaction: create_scenario_artifact + denormalized snapshot per item
      5. invalidate_tags
    """
    from app.routes.v5.api.main.scenario.permissions import compute_can_create
    from app.routes.v5.api.main.scenario.types import (
        CreateScenarioApiResponse,
        ScenarioResultItem,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Permission check ───────────────────────────────────────

    if not compute_can_create(user_role=profile.role, department_ids=None):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to create scenarios.",
        )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[ScenarioResultItem] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_scenario_values(conn, redis, item, is_create=True)
        if item_errors:
            has_errors = True
            error_results.append(
                ScenarioResultItem(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(ScenarioResultItem(success=True, message="Validated"))

    if has_errors:
        return CreateScenarioApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[ScenarioResultItem] = []

    async with conn.transaction():
        for item in items:
            # Create denormalized snapshot
            scenarios_resource_id = await create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            flag_ids = _collect_flag_ids(item)

            result = await create_scenario_artifact(
                conn,
                name_id=item.name_id,
                description_id=item.description_id,
                department_ids=item.department_ids,
                flag_ids=flag_ids,
                document_ids=item.document_ids,
                image_ids=item.image_ids,
                objective_ids=item.objective_ids,
                option_ids=item.option_ids,
                parameter_field_ids=item.parameter_field_ids,
                persona_ids=item.persona_ids,
                problem_statement_ids=[item.problem_statement_id]
                if item.problem_statement_id
                else None,
                question_ids=item.question_ids,
                video_ids=item.video_ids,
                scenario_ids=[scenarios_resource_id],
            )

            results.append(
                ScenarioResultItem(
                    success=True,
                    scenario_id=result.id,
                    message="Scenario created successfully",
                )
            )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["scenarios"], redis=redis)

    return CreateScenarioApiResponse(results=results)

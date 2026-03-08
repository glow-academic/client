"""Tool create logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role)
  2. compute_can_create — permission check
  3. resolve_tool_values — raw value → ID resolution
  4. create_tool_artifact — junction writes
  5. create_denormalized_snapshot — tools_resource snapshot
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from fastapi import HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.tool_permissions_context import (
    create_denormalized_snapshot,
    resolve_tool_values,
)
from app.routes.v5.tools.artifacts.tool.create import (
    create_tool as create_tool_artifact,
)
from app.utils.cache.invalidate_tags import invalidate_tags


class CreateToolItem(BaseModel):
    """Single tool item for create — no tool_id.

    Required fields (name): provide ID or value.
    """

    id: UUID | None = None

    # Dual-mode: name
    name_id: UUID | None = None
    name: str | None = None
    # Dual-mode: description
    description_id: UUID | None = None
    description: str | None = None
    # ID-only fields
    department_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    arg_positions_ids: list[UUID] | None = None
    args_ids: list[UUID] | None = None
    args_outputs_ids: list[UUID] | None = None
    artifact_ids: list[UUID] | None = None
    entry_ids: list[UUID] | None = None
    operation_ids: list[UUID] | None = None
    resource_ids: list[UUID] | None = None
    tool_ids: list[UUID] | None = None


async def create_tool_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list,
    group_id: UUID | None = None,
) -> dict:
    """Tool bulk create using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role
      2. compute_can_create — single check (applies to all items)
      3. Per-item value resolution (raw → ID, required field enforcement)
      4. Single transaction: create_tool_artifact + denormalized snapshot per item
      5. invalidate_tags
    """
    from app.infra.tool_permissions import compute_can_create
    from app.routes.v5.api.main.tool.types import (
        CreateToolApiResponse,
        ToolResultItem,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Permission check ───────────────────────────────────────

    if not compute_can_create(user_role=profile.role):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to create tools.",
        )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[ToolResultItem] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_tool_values(conn, redis, item, is_create=True)
        if item_errors:
            has_errors = True
            error_results.append(
                ToolResultItem(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(ToolResultItem(success=True, message="Validated"))

    if has_errors:
        return CreateToolApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[ToolResultItem] = []

    async with conn.transaction():
        for item in items:
            # Create denormalized snapshot
            tools_resource_id = await create_denormalized_snapshot(
                conn,
                redis,
                id=item.id,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            result = await create_tool_artifact(
                conn,
                id=item.id,
                name_id=item.name_id,
                description_id=item.description_id,
                department_ids=item.department_ids,
                flag_ids=item.flag_ids,
                arg_positions_ids=item.arg_positions_ids,
                args_ids=item.args_ids,
                args_outputs_ids=item.args_outputs_ids,
                artifact_ids=item.artifact_ids,
                entry_ids=item.entry_ids,
                operation_ids=item.operation_ids,
                resource_ids=item.resource_ids,
                tool_ids=[tools_resource_id],
            )

            results.append(
                ToolResultItem(
                    success=True,
                    tool_id=result.id,
                    message="Tool created successfully",
                )
            )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["tools"], redis=redis)

    return CreateToolApiResponse(results=results)

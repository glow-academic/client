"""Tool save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role)
  2. resolve_tool_permissions_context — access check
  3. Resource create tools — raw value → ID resolution
  4. Artifact create/update tools — junction writes
  5. Tool resource create tool — denormalized snapshot
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.tool_permissions_context import resolve_tool_permissions_context

# Artifact tools
from app.routes.v5.tools.artifacts.tool.create import (
    create_tool as create_tool_artifact,
)
from app.routes.v5.tools.artifacts.tool.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.tool.update import (
    update_tool as update_tool_artifact,
)

# Resource create tools (raw value → ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.tools.create import (
    create_tool as create_tool_resource,
)
from app.utils.cache.invalidate_tags import invalidate_tags

if TYPE_CHECKING:
    from app.routes.v5.api.main.tool.types import (
        SaveToolApiResponse,
        SaveToolFieldError,
        SaveToolItem,
        SaveToolResult,
    )


# ---------------------------------------------------------------------------
# Value resolution — raw value → ID via create tools
# ---------------------------------------------------------------------------


async def resolve_tool_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: SaveToolItem,
    is_update: bool,
) -> list[SaveToolFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.tool.types import SaveToolFieldError

    errors: list[SaveToolFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    if item.description is not None and item.description_id is None:
        result = await create_description(conn, item.description, redis)
        item.description_id = result.id

    # --- Validate required fields (create only) ---

    if not is_update:
        if item.name_id is None and item.name is None:
            errors.append(SaveToolFieldError(field="name", message="Name is required"))

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
    """Create a tools_resource snapshot by hydrating IDs to values."""

    async def _empty() -> list:
        return []

    (
        names,
        descriptions,
    ) = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_tool_resource(
        conn,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
        redis=redis,
    )
    return result.id


# ---------------------------------------------------------------------------
# save_tool_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_tool_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveToolItem],
    group_id: UUID | None = None,
) -> SaveToolApiResponse:
    """Tool save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw → ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
    """
    from app.routes.v5.api.main.tool.permissions import (
        compute_can_create,
        compute_can_edit,
    )
    from app.routes.v5.api.main.tool.types import (
        SaveToolApiResponse,
        SaveToolResult,
    )

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Per-item permission check --

    for idx, item in enumerate(items):
        if item.input_tool_id is not None:
            perms = await resolve_tool_permissions_context(conn, item.input_tool_id)
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Tool {item.input_tool_id} not found.",
                )
            if not compute_can_edit(
                user_role=profile.role,
                active_agent_count=perms.active_agent_count,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this tool.",
                )
        else:
            if not compute_can_create(
                user_role=profile.role,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to create a tool.",
                )

    # -- Step 3: Per-item value resolution --

    has_errors = False
    error_results: list[SaveToolResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_tool_values(
            conn,
            redis,
            item,
            is_update=item.input_tool_id is not None,
        )
        if item_errors:
            has_errors = True
            error_results.append(
                SaveToolResult(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(SaveToolResult(success=True, message="Validated"))

    if has_errors:
        return SaveToolApiResponse(results=error_results)

    # -- Step 4: Single transaction --

    results: list[SaveToolResult] = []

    async with conn.transaction():
        for _idx, item in enumerate(items):
            is_update = item.input_tool_id is not None

            # Create denormalized snapshot
            tools_resource_id = await _create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            if is_update:
                result = await update_tool_artifact(
                    conn,
                    item.input_tool_id,
                    name_id=item.name_id if item.name_id else _UNSET,
                    description_id=item.description_id
                    if item.description_id
                    else _UNSET,
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
                tool_id = result.id
            else:
                result = await create_tool_artifact(
                    conn,
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
                tool_id = result.id

            results.append(
                SaveToolResult(
                    success=True,
                    tool_id=tool_id,
                    message="Tool updated successfully"
                    if is_update
                    else "Tool created successfully",
                )
            )

    # -- Step 5: Invalidate cache --

    await invalidate_tags(["tools"], redis=redis)

    return SaveToolApiResponse(results=results)

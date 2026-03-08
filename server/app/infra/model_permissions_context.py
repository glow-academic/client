"""Model permissions context + shared save helpers.

Permissions context:
  1. resolve_model_permissions_context — lightweight access + edit check

Shared save helpers (used by both create and update):
  2. resolve_model_values — raw string → resource ID resolution
  3. create_denormalized_snapshot — hydrate IDs → models_resource snapshot

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.routes.v5.tools.artifacts.agent.search import search_agents
from app.routes.v5.tools.artifacts.model.get import (
    get_models as get_model_artifacts,
)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.models.create import (
    create_model as create_model_resource,
)
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names

if TYPE_CHECKING:
    from app.routes.v5.api.main.model.types import (
        CreateModelItem,
        ModelFieldError,
        UpdateModelItem,
    )


@dataclass(frozen=True)
class ModelPermissionsContext:
    """Lightweight context for model permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_agent_count: int


async def resolve_model_permissions_context(
    conn: asyncpg.Connection,
    model_id: UUID,
) -> ModelPermissionsContext:
    """Fetch just what's needed for model permission checks.

    Two black-box tool calls:
      1. get_model_artifacts → department_ids + model_ids (resource IDs)
      2. search_agents(model_ids=...) → any active agents using this model?
    """
    artifacts = await get_model_artifacts(
        conn,
        [model_id],
        departments=True,
        models=True,
    )

    if not artifacts:
        return ModelPermissionsContext(
            exists=False,
            department_ids=[],
            active_agent_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    model_resource_ids = list(artifact.model_ids or [])

    _, total = (
        await search_agents(
            conn,
            model_ids=model_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if model_resource_ids
        else ([], 0)
    )

    return ModelPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_agent_count=total,
    )


# ---------------------------------------------------------------------------
# Shared save helpers — used by both model_create and model_update
# ---------------------------------------------------------------------------


async def resolve_model_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: CreateModelItem | UpdateModelItem,
    is_create: bool,
) -> list[ModelFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.
    For 'match' resources (departments):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.model.types import ModelFieldError

    errors: list[ModelFieldError] = []

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
            model=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    ModelFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    # --- Validate required fields (create only) ---

    if is_create:
        if item.name_id is None and item.name is None:
            errors.append(ModelFieldError(field="name", message="Name is required"))

    return errors


async def create_denormalized_snapshot(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    name_id: UUID | None,
    description_id: UUID | None,
) -> UUID:
    """Create a models_resource snapshot by hydrating IDs to values."""

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

    result = await create_model_resource(
        conn,
        value="",
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
        redis=redis,
    )
    return result.id

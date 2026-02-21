"""Save function registry — maps artifact_type to save_*_internal.

Uses lazy imports (import inside function body) to avoid circular dependencies.
Only 16 artifact types have save functions; the rest (analytics/pool-based) do not.
"""

import importlib
from typing import Any
from uuid import UUID

import asyncpg

from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

# artifact_type → module path containing save_{artifact_type}_internal
SAVE_REGISTRY: dict[str, str] = {
    "agent": "app.api.v4.artifacts.agent.save",
    "auth": "app.api.v4.artifacts.auth.save",
    "cohort": "app.api.v4.artifacts.cohort.save",
    "department": "app.api.v4.artifacts.department.save",
    "document": "app.api.v4.artifacts.document.save",
    "eval": "app.api.v4.artifacts.eval.save",
    "field": "app.api.v4.artifacts.field.save",
    "model": "app.api.v4.artifacts.model.save",
    "parameter": "app.api.v4.artifacts.parameter.save",
    "persona": "app.api.v4.artifacts.persona.save",
    "profile": "app.api.v4.artifacts.profile.save",
    "rubric": "app.api.v4.artifacts.rubric.save",
    "scenario": "app.api.v4.artifacts.scenario.save",
    "setting": "app.api.v4.artifacts.setting.save",
    "simulation": "app.api.v4.artifacts.simulation.save",
    "tool": "app.api.v4.artifacts.tool.save",
}


async def save_artifact(
    artifact_type: str,
    conn: asyncpg.Connection,
    profile_id: UUID,
    group_id: UUID,
    resource_actions: dict[str, Any],
) -> UUID | None:
    """Call the appropriate save_*_internal for the given artifact_type.

    Returns the saved artifact ID, or None if no save function exists.
    """
    module_path = SAVE_REGISTRY.get(artifact_type)
    if not module_path:
        return None

    module = importlib.import_module(module_path)
    save_fn = getattr(module, f"save_{artifact_type}_internal")
    return await save_fn(
        conn=conn,
        profile_id=profile_id,
        group_id=group_id,
        resource_actions=resource_actions,
    )

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
    "agent": "app.v5.api.main.agent.save",
    "chat": "app.v5.api.main.chat.save",
    "auth": "app.v5.api.main.auth.save",
    "cohort": "app.v5.api.main.cohort.save",
    "department": "app.v5.api.main.department.save",
    "document": "app.v5.api.main.document.save",
    "eval": "app.v5.api.main.eval.save",
    "field": "app.v5.api.main.field.save",
    "model": "app.v5.api.main.model.save",
    "parameter": "app.v5.api.main.parameter.save",
    "persona": "app.v5.api.main.persona.save",
    "profile": "app.v5.api.main.profile.save",
    "rubric": "app.v5.api.main.rubric.save",
    "scenario": "app.v5.api.main.scenario.save",
    "setting": "app.v5.api.main.setting.save",
    "simulation": "app.v5.api.main.simulation.save",
    "tool": "app.v5.api.main.tool.save",
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

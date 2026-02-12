"""Reasoning Levels resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="reasoning_levels",
    table_name="reasoning_levels_resource",
    description="Reasoning level resources for AI reasoning configuration.",
    used_by_artifacts=["agent", "model"],
)


def get_reasoning_levels_docs() -> dict[str, Any]:
    """Get reasoning_levels documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

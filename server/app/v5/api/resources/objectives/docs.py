"""Objectives resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="objectives",
    table_name="objectives_resource",
    description="Objective resources for defining learning objectives.",
    used_by_artifacts=["scenario"],
)


def get_objectives_docs() -> dict[str, Any]:
    """Get objectives documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

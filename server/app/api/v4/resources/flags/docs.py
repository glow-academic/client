"""Flags resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="flags",
    table_name="flags_resource",
    description="Flag resources for feature flags and settings.",
    used_by_artifacts=["agent", "persona", "scenario"],
)


def get_flags_docs() -> dict[str, Any]:
    """Get flags documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

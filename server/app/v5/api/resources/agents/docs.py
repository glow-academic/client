"""Agents resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="agents",
    table_name="agents_resource",
    description="Agent resources for AI agent configuration.",
    used_by_artifacts=["agent", "setting"],
)


def get_agents_docs() -> dict[str, Any]:
    """Get agents documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

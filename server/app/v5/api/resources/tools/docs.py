"""Tool resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="tools",
    table_name="tools_resource",
    description="Tool resources for tool configuration.",
    used_by_artifacts=["tool"],
)


def get_tools_docs() -> dict[str, Any]:
    """Get tools documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

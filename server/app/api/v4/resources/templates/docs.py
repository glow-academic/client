"""Templates resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="templates",
    table_name="templates_resource",
    description="Template resources for document and tool templates.",
    used_by_artifacts=["document", "tool"],
)


def get_templates_docs() -> dict[str, Any]:
    """Get templates documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

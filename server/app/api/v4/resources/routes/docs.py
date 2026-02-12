"""Route resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="routes",
    table_name="routes_resource",
    description="Route resources for defining available routes.",
    used_by_artifacts=["setting"],
)


def get_routes_docs() -> dict[str, Any]:
    """Get routes documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

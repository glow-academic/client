"""Resources resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="resources",
    table_name="resources_resource",
    description="Resources resource for defining available resource types.",
)


def get_resources_docs() -> dict[str, Any]:
    """Get resources documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

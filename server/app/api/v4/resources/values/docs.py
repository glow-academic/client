"""Values resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="values",
    table_name="values_resource",
    description="Value resources for generic configurable values.",
    used_by_artifacts=["parameter"],
)


def get_values_docs() -> dict[str, Any]:
    """Get values documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

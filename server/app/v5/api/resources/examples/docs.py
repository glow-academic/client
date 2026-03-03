"""Examples resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="examples",
    table_name="examples_resource",
    description="Example resources for providing sample data and demonstrations.",
    used_by_artifacts=["persona"],
)


def get_examples_docs() -> dict[str, Any]:
    """Get examples documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Items resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="items",
    table_name="items_resource",
    description="Item resources for generic key-value data items.",
    used_by_artifacts=["auth"],
)


def get_items_docs() -> dict[str, Any]:
    """Get items documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

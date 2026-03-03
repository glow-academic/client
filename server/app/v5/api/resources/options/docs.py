"""Options resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="options",
    table_name="options_resource",
    description="Option resources for configurable choices and selections.",
    used_by_artifacts=["parameter"],
)


def get_options_docs() -> dict[str, Any]:
    """Get options documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

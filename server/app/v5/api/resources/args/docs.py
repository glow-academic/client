"""Args resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="args",
    table_name="args_resource",
    description="Argument resources for configuring parameters and inputs.",
    used_by_artifacts=["parameter"],
)


def get_args_docs() -> dict[str, Any]:
    """Get args documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

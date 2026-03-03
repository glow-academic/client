"""Args Outputs resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="args_outputs",
    table_name="args_outputs_resource",
    description="Argument output resources for tracking parameter outputs.",
    used_by_artifacts=["parameter"],
)


def get_args_outputs_docs() -> dict[str, Any]:
    """Get args_outputs documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

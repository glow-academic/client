"""Parameters resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="parameters",
    table_name="parameters_resource",
    description="Parameter resources for persona parameter configuration.",
    used_by_artifacts=["parameter"],
)


def get_parameters_docs() -> dict[str, Any]:
    """Get parameters documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

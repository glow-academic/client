"""Conditional parameters resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="conditional_parameters",
    table_name="conditional_parameters_resource",
    description="Conditional parameter resources for field conditional logic.",
    used_by_artifacts=["field"],
)


def get_conditional_parameters_docs() -> dict[str, Any]:
    """Get conditional_parameters documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

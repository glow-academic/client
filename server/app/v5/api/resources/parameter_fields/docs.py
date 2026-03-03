"""Parameter Fields resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="parameter_fields",
    table_name="parameter_fields_resource",
    description="Parameter field resources linking parameters to fields.",
    used_by_artifacts=["document", "persona"],
)


def get_parameter_fields_docs() -> dict[str, Any]:
    """Get parameter_fields documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

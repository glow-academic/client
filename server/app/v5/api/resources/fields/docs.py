"""Fields resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="fields",
    table_name="fields_resource",
    description="Field resources for parameter field definitions.",
    used_by_artifacts=["field"],
)


def get_fields_docs() -> dict[str, Any]:
    """Get fields documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Standard Groups resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="standard_groups",
    table_name="standard_groups_resource",
    description="Standard group resources for rubric standard groupings.",
    used_by_artifacts=["rubric"],
)


def get_standard_groups_docs() -> dict[str, Any]:
    """Get standard_groups documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Group Positions resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="group_positions",
    table_name="group_positions_resource",
    description="Group position resources for ordering items within groups.",
    used_by_artifacts=["eval"],
)


def get_group_positions_docs() -> dict[str, Any]:
    """Get group_positions documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

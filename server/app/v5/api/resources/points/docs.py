"""Points resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="points",
    table_name="points_resource",
    description="Point resources for rubric scoring criteria.",
    used_by_artifacts=["rubric"],
)


def get_points_docs() -> dict[str, Any]:
    """Get points documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

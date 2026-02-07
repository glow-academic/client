"""Group Rubrics resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="group_rubrics",
    table_name="group_rubrics_resource",
    description="Group rubric resources linking rubrics to groups.",
    used_by_artifacts=["eval"],
)


def get_group_rubrics_docs() -> dict[str, Any]:
    """Get group_rubrics documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

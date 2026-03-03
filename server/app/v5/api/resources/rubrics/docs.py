"""Rubric resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="rubrics",
    table_name="rubrics_resource",
    description="Rubric resources for evaluation rubric configuration.",
    used_by_artifacts=["rubric", "simulation"],
)


def get_rubrics_docs() -> dict[str, Any]:
    """Get rubrics documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

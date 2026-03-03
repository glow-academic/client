"""Questions resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="questions",
    table_name="questions_resource",
    description="Question resources for scenario-based questions.",
    used_by_artifacts=["scenario"],
)


def get_questions_docs() -> dict[str, Any]:
    """Get questions documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Groups resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="groups",
    table_name="groups_resource",
    description="Group resources for organizing artifacts into groups.",
    used_by_artifacts=[
        "agent",
        "auth",
        "cohort",
        "department",
        "eval",
        "field",
        "model",
        "parameter",
        "persona",
        "profile",
        "provider",
        "rubric",
        "scenario",
        "setting",
        "simulation",
        "tool",
    ],
)


def get_groups_docs() -> dict[str, Any]:
    """Get groups documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

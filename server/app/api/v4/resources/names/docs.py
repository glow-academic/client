"""Names resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="names",
    table_name="names_resource",
    description="Name resources providing display names for artifacts.",
    used_by_artifacts=[
        "agent",
        "auth",
        "cohort",
        "department",
        "document",
        "eval",
        "field",
        "model",
        "parameter",
        "persona",
        "provider",
        "rubric",
        "scenario",
        "setting",
        "simulation",
        "tool",
    ],
)


def get_names_docs() -> dict[str, Any]:
    """Get names documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

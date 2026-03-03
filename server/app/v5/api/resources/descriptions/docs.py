"""Descriptions resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="descriptions",
    table_name="descriptions_resource",
    description="Description resources providing text descriptions for artifacts.",
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


def get_descriptions_docs() -> dict[str, Any]:
    """Get descriptions documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

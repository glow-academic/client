"""Problem Statements resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="problem_statements",
    table_name="problem_statements_resource",
    description="Problem statement resources for scenario problem definitions.",
    used_by_artifacts=["scenario"],
)


def get_problem_statements_docs() -> dict[str, Any]:
    """Get problem_statements documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

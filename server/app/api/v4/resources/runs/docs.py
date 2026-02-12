"""Run resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="runs",
    table_name="runs_resource",
    description="Run resources for agent run configuration.",
    used_by_artifacts=["agent"],
)


def get_runs_docs() -> dict[str, Any]:
    """Get runs documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Run Positions resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="run_positions",
    table_name="run_positions_resource",
    description="Run position resources for ordering runs within groups.",
    used_by_artifacts=["eval"],
)


def get_run_positions_docs() -> dict[str, Any]:
    """Get run_positions documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

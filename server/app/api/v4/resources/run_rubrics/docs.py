"""Run Rubrics resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="run_rubrics",
    table_name="run_rubrics_resource",
    description="Run rubric resources linking rubrics to evaluation runs.",
    used_by_artifacts=["eval"],
)


def get_run_rubrics_docs() -> dict[str, Any]:
    """Get run_rubrics documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

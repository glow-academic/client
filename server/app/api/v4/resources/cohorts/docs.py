"""Cohorts resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="cohorts",
    table_name="cohorts_resource",
    description="Cohort resources for cohort configuration.",
    used_by_artifacts=["cohort"],
)


def get_cohorts_docs() -> dict[str, Any]:
    """Get cohorts documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

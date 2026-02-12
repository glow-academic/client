"""Threshold resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="thresholds",
    table_name="thresholds_resource",
    description="Threshold resources for rubric scoring thresholds.",
    used_by_artifacts=["rubric"],
)


def get_thresholds_docs() -> dict[str, Any]:
    """Get thresholds documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

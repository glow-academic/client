"""Qualities resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="qualities",
    table_name="qualities_resource",
    description="Quality resources for model quality level configuration.",
    used_by_artifacts=["model"],
)


def get_qualities_docs() -> dict[str, Any]:
    """Get qualities documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

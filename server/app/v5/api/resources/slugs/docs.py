"""Slugs resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="slugs",
    table_name="slugs_resource",
    description="Slug resources for URL-friendly identifiers.",
    used_by_artifacts=["auth"],
)


def get_slugs_docs() -> dict[str, Any]:
    """Get slugs documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Domains resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="domains",
    table_name="domains_resource",
    description="Domain resources for defining available resource types.",
)


def get_domains_docs() -> dict[str, Any]:
    """Get domains documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

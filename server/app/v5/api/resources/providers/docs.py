"""Providers resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="providers",
    table_name="providers_resource",
    description="Provider resources for AI provider configuration.",
    used_by_artifacts=["provider"],
)


def get_providers_docs() -> dict[str, Any]:
    """Get providers documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

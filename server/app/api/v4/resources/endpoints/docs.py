"""Endpoints resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="endpoints",
    table_name="endpoints_resource",
    description="Endpoint resources for API endpoint configurations.",
    used_by_artifacts=["provider"],
)


def get_endpoints_docs() -> dict[str, Any]:
    """Get endpoints documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

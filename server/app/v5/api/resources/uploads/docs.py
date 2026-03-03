"""Uploads resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="uploads",
    table_name="uploads_resource",
    description="Upload resources for file upload management.",
    used_by_artifacts=["document"],
)


def get_uploads_docs() -> dict[str, Any]:
    """Get uploads documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

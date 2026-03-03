"""Images resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="images",
    table_name="images_resource",
    description="Image resources for visual content and avatars.",
    used_by_artifacts=["persona", "scenario"],
)


def get_images_docs() -> dict[str, Any]:
    """Get images documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

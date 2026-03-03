"""Videos resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="videos",
    table_name="videos_resource",
    description="Video resources for video content management.",
    used_by_artifacts=["scenario"],
)


def get_videos_docs() -> dict[str, Any]:
    """Get videos documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

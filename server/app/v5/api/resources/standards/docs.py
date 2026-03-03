"""Standard resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="standards",
    table_name="standards_resource",
    description="Standard resources for evaluation standard definitions.",
    used_by_artifacts=["eval"],
)


def get_standards_docs() -> dict[str, Any]:
    """Get standards documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

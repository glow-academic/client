"""Colors resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="colors",
    table_name="colors_resource",
    description="Color resources for UI theming and customization.",
    used_by_artifacts=["setting"],
)


def get_colors_docs() -> dict[str, Any]:
    """Get colors documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

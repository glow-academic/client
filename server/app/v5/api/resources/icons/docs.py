"""Icons resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="icons",
    table_name="icons_resource",
    description="Icon resources for persona avatar icons.",
    used_by_artifacts=["persona"],
)


def get_icons_docs() -> dict[str, Any]:
    """Get icons documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

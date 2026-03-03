"""Setting resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="settings",
    table_name="settings_resource",
    description="Setting resources for system settings configuration.",
    used_by_artifacts=["setting"],
)


def get_settings_docs() -> dict[str, Any]:
    """Get settings documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

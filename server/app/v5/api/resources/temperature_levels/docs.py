"""Temperature level resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="temperature_levels",
    table_name="temperature_levels_resource",
    description="Temperature level resources for AI temperature configuration.",
    used_by_artifacts=["agent", "model"],
)


def get_temperature_levels_docs() -> dict[str, Any]:
    """Get temperature_levels documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Models resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="models",
    table_name="models_resource",
    description="Model resources for AI model configuration.",
    used_by_artifacts=["agent", "model", "provider"],
)


def get_models_docs() -> dict[str, Any]:
    """Get models documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

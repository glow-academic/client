"""Model position resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="model_positions",
    table_name="model_positions_resource",
    description="Model position resources for eval model positions.",
    used_by_artifacts=["eval"],
)


def get_model_positions_docs() -> dict[str, Any]:
    """Get model_positions documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

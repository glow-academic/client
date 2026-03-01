"""Model flag resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="model_flags",
    table_name="model_flags_resource",
    description="Model flag resources for eval model flags.",
    used_by_artifacts=["eval"],
)


def get_model_flags_docs() -> dict[str, Any]:
    """Get model_flags documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

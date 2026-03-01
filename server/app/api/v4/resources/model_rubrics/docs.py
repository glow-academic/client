"""Model rubric resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="model_rubrics",
    table_name="model_rubrics_resource",
    description="Model rubric resources for eval model rubrics.",
    used_by_artifacts=["eval"],
)


def get_model_rubrics_docs() -> dict[str, Any]:
    """Get model_rubrics documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

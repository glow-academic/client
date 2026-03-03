"""Prompts resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="prompts",
    table_name="prompts_resource",
    description="Prompt resources for AI system and user prompts.",
    used_by_artifacts=["persona"],
)


def get_prompts_docs() -> dict[str, Any]:
    """Get prompts documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Voices resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="voices",
    table_name="voices_resource",
    description="Voice resources for AI voice configuration.",
    used_by_artifacts=["persona"],
)


def get_voices_docs() -> dict[str, Any]:
    """Get voices documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Texts resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="texts",
    table_name="texts_resource",
    description="Text resources for document content.",
    used_by_artifacts=["document"],
)


def get_texts_docs() -> dict[str, Any]:
    """Get texts documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

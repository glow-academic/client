"""Bindings resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="bindings",
    table_name="bindings_resource",
    description="Binding resources for tool entry bindings.",
    used_by_artifacts=["tool"],
)


def get_bindings_docs() -> dict[str, Any]:
    """Get bindings documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

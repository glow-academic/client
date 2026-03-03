"""Entries resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="entries",
    table_name="entries_resource",
    description="Entries resource for defining available entry types.",
    used_by_artifacts=["tool"],
)


def get_entries_docs() -> dict[str, Any]:
    """Get entries documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

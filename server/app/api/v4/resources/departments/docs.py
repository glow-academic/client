"""Departments resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="departments",
    table_name="departments_resource",
    description="Department resources for organizational grouping.",
    used_by_artifacts=["auth", "department", "provider", "tool"],
)


def get_departments_docs() -> dict[str, Any]:
    """Get departments documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

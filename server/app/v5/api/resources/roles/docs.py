"""Roles resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="roles",
    table_name="roles_resource",
    description="Role resources for access control roles.",
    used_by_artifacts=["setting"],
)


def get_roles_docs() -> dict[str, Any]:
    """Get roles documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

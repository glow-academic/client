"""Role Routes resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="role_routes",
    table_name="role_routes_resource",
    description="Role route resources linking roles to routes.",
    used_by_artifacts=["setting"],
)


def get_role_routes_docs() -> dict[str, Any]:
    """Get role_routes documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

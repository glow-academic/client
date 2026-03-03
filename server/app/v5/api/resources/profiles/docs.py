"""Profiles resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="profiles",
    table_name="profiles_resource",
    description="Profile resources for user profile configuration.",
    used_by_artifacts=["profile"],
)


def get_profiles_docs() -> dict[str, Any]:
    """Get profiles documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

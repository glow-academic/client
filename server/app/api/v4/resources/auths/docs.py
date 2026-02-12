"""Auths resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="auths",
    table_name="auths_resource",
    description="Auth resources for authentication configuration.",
    used_by_artifacts=["auth"],
)


def get_auths_docs() -> dict[str, Any]:
    """Get auths documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

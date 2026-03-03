"""Protocols resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="protocols",
    table_name="protocols_resource",
    description="Protocol resources for authentication protocol definitions.",
    used_by_artifacts=["auth"],
)


def get_protocols_docs() -> dict[str, Any]:
    """Get protocols documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

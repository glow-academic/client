"""Keys resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="keys",
    table_name="keys_resource",
    description="Key resources for API key management.",
    used_by_artifacts=["setting"],
)


def get_keys_docs() -> dict[str, Any]:
    """Get keys documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

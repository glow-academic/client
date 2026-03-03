"""Provider Keys resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="provider_keys",
    table_name="provider_keys_resource",
    description="Provider key resources for API provider key management.",
    used_by_artifacts=["provider", "setting"],
)


def get_provider_keys_docs() -> dict[str, Any]:
    """Get provider_keys documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

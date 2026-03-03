"""Auth item keys resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="auth_item_keys",
    table_name="auth_item_keys_resource",
    description="Auth item key resources for authentication item keys.",
    used_by_artifacts=["auth"],
)


def get_auth_item_keys_docs() -> dict[str, Any]:
    """Get auth_item_keys documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

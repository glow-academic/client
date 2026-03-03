"""Request Limits resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="request_limits",
    table_name="request_limits_resource",
    description="Request limit resources for rate limiting configurations.",
    used_by_artifacts=["model"],
)


def get_request_limits_docs() -> dict[str, Any]:
    """Get request_limits documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

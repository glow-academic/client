"""Emails resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="emails",
    table_name="emails_resource",
    description="Email resources for user contact information.",
    used_by_artifacts=["profile"],
)


def get_emails_docs() -> dict[str, Any]:
    """Get emails documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

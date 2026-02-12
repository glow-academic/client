"""Documents resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="documents",
    table_name="documents_resource",
    description="Document resources for document configuration.",
    used_by_artifacts=["document", "persona"],
)


def get_documents_docs() -> dict[str, Any]:
    """Get documents documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

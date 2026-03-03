"""Instructions resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="instructions",
    table_name="instructions_resource",
    description="Instruction resources for AI persona behavior instructions.",
    used_by_artifacts=["persona"],
)


def get_instructions_docs() -> dict[str, Any]:
    """Get instructions documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

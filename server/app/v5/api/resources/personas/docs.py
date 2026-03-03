"""Personas resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="personas",
    table_name="personas_resource",
    description="Persona resources for persona configuration.",
    used_by_artifacts=["persona"],
)


def get_personas_docs() -> dict[str, Any]:
    """Get personas documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

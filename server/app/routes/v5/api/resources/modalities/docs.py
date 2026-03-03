"""Modalities resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="modalities",
    table_name="modalities_resource",
    description="Modality resources for model input/output modalities.",
    used_by_artifacts=["model"],
)


def get_modalities_docs() -> dict[str, Any]:
    """Get modalities documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

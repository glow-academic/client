"""Pricing resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="pricing",
    table_name="pricing_resource",
    description="Pricing resources for model cost configuration.",
    used_by_artifacts=["model"],
)


def get_pricing_docs() -> dict[str, Any]:
    """Get pricing documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

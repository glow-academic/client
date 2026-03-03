"""Scenario resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="scenarios",
    table_name="scenarios_resource",
    description="Scenario resources for scenario configuration.",
    used_by_artifacts=["scenario"],
)


def get_scenarios_docs() -> dict[str, Any]:
    """Get scenarios documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

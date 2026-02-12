"""Scenario flag resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="scenario_flags",
    table_name="scenario_flags_resource",
    description="Scenario flag resources for simulation scenario flags.",
    used_by_artifacts=["simulation"],
)


def get_scenario_flags_docs() -> dict[str, Any]:
    """Get scenario_flags documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

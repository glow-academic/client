"""Scenario time limit resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="scenario_time_limits",
    table_name="scenario_time_limits_resource",
    description="Scenario time limit resources for simulation time constraints.",
    used_by_artifacts=["simulation"],
)


def get_scenario_time_limits_docs() -> dict[str, Any]:
    """Get scenario_time_limits documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

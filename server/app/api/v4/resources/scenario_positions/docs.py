"""Scenario Positions resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="scenario_positions",
    table_name="scenario_positions_resource",
    description="Scenario position resources for ordering scenarios in simulations.",
    used_by_artifacts=["simulation"],
)


def get_scenario_positions_docs() -> dict[str, Any]:
    """Get scenario_positions documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

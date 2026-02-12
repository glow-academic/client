"""Scenario persona resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="scenario_personas",
    table_name="scenario_personas_resource",
    description="Scenario persona resources linking personas to simulations.",
    used_by_artifacts=["simulation"],
)


def get_scenario_personas_docs() -> dict[str, Any]:
    """Get scenario_personas documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

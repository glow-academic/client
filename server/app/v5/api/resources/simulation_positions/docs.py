"""Simulation Positions resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="simulation_positions",
    table_name="simulation_positions_resource",
    description="Simulation position resources for ordering simulations.",
    used_by_artifacts=["cohort"],
)


def get_simulation_positions_docs() -> dict[str, Any]:
    """Get simulation_positions documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

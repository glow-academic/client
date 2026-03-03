"""Simulation Availability resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import ResourceDocsConfig, build_resource_docs_static

CONFIG = ResourceDocsConfig(
    name="simulation_availability",
    table_name="simulation_availability_resource",
    description="Simulation availability resources for scheduling simulation start and end times.",
    used_by_artifacts=["cohort"],
)


def get_simulation_availability_docs() -> dict[str, Any]:
    """Get simulation_availability documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

"""Simulation resource documentation."""

from typing import Any

from app.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="simulations",
    table_name="simulations_resource",
    description="Simulation resources for simulation configuration.",
    used_by_artifacts=["simulation"],
)


def get_simulations_docs() -> dict[str, Any]:
    """Get simulations documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

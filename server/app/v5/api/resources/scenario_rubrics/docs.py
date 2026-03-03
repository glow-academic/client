"""Scenario Rubrics resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="scenario_rubrics",
    table_name="scenario_rubrics_resource",
    description="Scenario rubric resources linking rubrics to scenarios.",
    used_by_artifacts=["simulation"],
)


def get_scenario_rubrics_docs() -> dict[str, Any]:
    """Get scenario_rubrics documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

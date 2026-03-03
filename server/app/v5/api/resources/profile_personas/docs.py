"""Profile persona resource documentation."""

from typing import Any

from app.v5.utils.docs_helper import (
    ResourceDocsConfig,
    build_resource_docs_static,
)

CONFIG = ResourceDocsConfig(
    name="profile_personas",
    table_name="profile_personas_resource",
    description="Profile persona resources linking personas to profiles in cohorts.",
    used_by_artifacts=["cohort"],
)


def get_profile_personas_docs() -> dict[str, Any]:
    """Get profile_personas documentation (static portions, for MCP)."""
    return build_resource_docs_static(CONFIG)

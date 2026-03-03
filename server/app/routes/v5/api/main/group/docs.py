"""Group artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
)

CONFIG = ArtifactDocsConfig(
    name="group",
    plural_name="groups",
    entity_type="artifact",
    table_name="group_artifact",
    junction_prefix="group",
    fk_pattern="group_%",
    api_routing={
        "base_path": "/api/v5/group",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single group by ID",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List groups with filters",
            },
        },
    },
    glow_context={
        "description": "Groups represent collections of simulation runs organized for evaluation and tracking purposes.",
        "use_cases": [
            "Organizing simulation runs into groups",
            "Tracking group-level performance metrics",
            "Viewing group details and member runs",
        ],
        "related_concepts": [
            "Evals - Groups belong to evals",
            "Sessions - Groups contain sessions",
            "Pricing - Group-level pricing aggregation",
        ],
    },
)

router = APIRouter()


@router.post("/docs")
async def get_group_docs_endpoint() -> dict[str, Any]:
    return build_artifact_docs_static(CONFIG)


def get_groups_docs() -> dict[str, Any]:
    """Get group documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)

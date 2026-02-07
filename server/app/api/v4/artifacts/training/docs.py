"""Training artifact documentation."""

from typing import Any

from app.api.v4.artifacts.training import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="training",
    plural_name="training",
    entity_type="analytics",
    permissions_module=permissions,
    permission_functions=[
        "compute_mode",
        "compute_score_status",
        "compute_pass_pct",
        "compute_status",
        "compute_status_instructional",
        "compute_completion_pct",
        "compute_show_view",
        "compute_show_continue",
    ],
    api_routing={
        "base_path": "/api/v4/training",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get training data with simulation cards and progress",
            },
            "refresh": {
                "path": "/refresh",
                "method": "POST",
                "description": "Refresh training materialized views",
            },
        },
    },
    glow_context={
        "description": "Training provides the main student-facing analytics, showing simulation cards with progress, scores, and completion status.",
        "use_cases": [
            "Viewing assigned simulations and progress",
            "Tracking training completion percentage",
            "Viewing pass/fail status per simulation",
            "Continuing in-progress training sessions",
        ],
        "related_concepts": [
            "Attempts - Training aggregates attempt data",
            "Simulations - Training cards represent simulations",
            "Sessions - Training tracks session progress",
            "Dashboard - Training metrics feed into dashboard",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_training_docs_static() -> dict[str, Any]:
    """Get training documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)

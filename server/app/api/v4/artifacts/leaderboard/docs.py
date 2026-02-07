"""Leaderboard artifact documentation."""

from typing import Any

from app.api.v4.artifacts.leaderboard import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
)

CONFIG = ArtifactDocsConfig(
    name="leaderboard",
    plural_name="leaderboard",
    entity_type="analytics",
    permissions_module=permissions,
    permission_functions=[
        "compute_accolade_winners",
    ],
    api_routing={
        "base_path": "/api/v4/leaderboard",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get leaderboard rankings and accolades",
            },
            "refresh": {
                "path": "/refresh",
                "method": "POST",
                "description": "Refresh leaderboard materialized views",
            },
        },
    },
    glow_context={
        "description": "Leaderboard provides competitive rankings and accolades for student performance across simulations.",
        "use_cases": [
            "Viewing student rankings by score",
            "Tracking accolade achievements",
            "Motivating students through competition",
        ],
        "related_concepts": [
            "Dashboard - Leaderboard feeds into dashboard",
            "Training - Leaderboard uses training scores",
            "Attempts - Leaderboard ranks attempt performance",
        ],
    },
)

router = create_artifact_docs_router(CONFIG)


def get_leaderboard_docs_static() -> dict[str, Any]:
    """Get leaderboard documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)

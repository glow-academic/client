"""Leaderboard artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.routes.v5.api.main.leaderboard import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
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
        "base_path": "/api/v5/leaderboard",
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
    page_metadata=PageMetadataConfig(
        list_title="Leaderboard",
        list_description="View leaderboard rankings and accolades for teaching assistant training. Track top performers, compare pedagogical skills, and celebrate achievements in simulation-based learning.",
        detail_title="Leaderboard",
        detail_description="Leaderboard rankings for teaching assistant training. View top performers and achievements.",
        new_title="New Leaderboard",
        new_description="Configure a new leaderboard for teaching assistant training.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_leaderboard_docs_endpoint(
    request: DocsApiRequest,
) -> DocsApiResponse:
    return compute_docs_metadata(CONFIG.page_metadata)


def get_leaderboard_docs_static() -> dict[str, Any]:
    """Get leaderboard documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)

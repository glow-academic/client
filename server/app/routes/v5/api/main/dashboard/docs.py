"""Dashboard artifact documentation."""

from typing import Any

from fastapi import APIRouter

from app.routes.v5.api.main.dashboard import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)

CONFIG = ArtifactDocsConfig(
    name="dashboard",
    plural_name="dashboard",
    entity_type="analytics",
    permissions_module=permissions,
    permission_functions=[
        "compute_header_metrics",
        "compute_primary_metrics",
        "compute_secondary_metrics",
        "compute_footer_metrics",
    ],
    api_routing={
        "base_path": "/api/v5/dashboard",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get dashboard data with metrics",
            },
            "refresh": {
                "path": "/refresh",
                "method": "POST",
                "description": "Refresh dashboard materialized views",
            },
        },
    },
    glow_context={
        "description": "Dashboard provides aggregated analytics and metrics for GLOW, including header, primary, secondary, and footer metric sections.",
        "use_cases": [
            "Viewing aggregated platform metrics",
            "Monitoring student progress and performance",
            "Tracking simulation completion rates",
            "Viewing department-level analytics",
        ],
        "related_concepts": [
            "Activity - Dashboard includes activity metrics",
            "Training - Dashboard shows training progress",
            "Attempts - Dashboard aggregates attempt data",
            "Sessions - Dashboard tracks session metrics",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Dashboard",
        list_description="Comprehensive learning and development dashboard for graduate teaching assistants. Track simulation-based practice sessions, review pedagogical assessments, and monitor teaching performance metrics.",
        detail_title="Dashboard",
        detail_description="Learning and development dashboard for teaching assistant training. View performance metrics and progress.",
        new_title="New Dashboard",
        new_description="Configure a new dashboard view for teaching assistant training.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_dashboard_docs_endpoint(
    request: DocsApiRequest,
) -> DocsApiResponse:
    return compute_docs_metadata(CONFIG.page_metadata)


def get_dashboard_docs_static() -> dict[str, Any]:
    """Get dashboard documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)

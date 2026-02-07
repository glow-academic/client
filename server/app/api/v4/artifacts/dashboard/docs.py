"""Dashboard artifact documentation."""

from typing import Any

from app.api.v4.artifacts.dashboard import permissions
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    build_artifact_docs_static,
    create_artifact_docs_router,
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
        "base_path": "/api/v4/dashboard",
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
)

router = create_artifact_docs_router(CONFIG)


def get_dashboard_docs_static() -> dict[str, Any]:
    """Get dashboard documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
